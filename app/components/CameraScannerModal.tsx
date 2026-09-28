'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  X,
  Zap,
} from 'lucide-react';
import Jscanify from 'jscanify/client';

type Props = {
  open: boolean;
  onCapture: (dataUrl: string, autoCropped: boolean) => void;
  onNativeCapture: (file: File) => void;
  onClose: () => void;
};

type CornerPoint = { x: number; y: number };
type Corners = {
  topLeftCorner?: CornerPoint;
  topRightCorner?: CornerPoint;
  bottomLeftCorner?: CornerPoint;
  bottomRightCorner?: CornerPoint;
};

type CvLike = {
  Mat?: unknown;
  imread: (src: HTMLCanvasElement) => unknown;
};

const OPENCV_SRC = 'https://docs.opencv.org/4.x/opencv.js';
const CAPTURE_WIDTH = 1600;
const CAPTURE_QUALITY = 0.85;

let opencvLoadPromise: Promise<void> | null = null;

function loadOpenCV(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OpenCV can only load in the browser.'));
  }
  const existing = (window as unknown as { cv?: CvLike }).cv;
  if (existing && existing.Mat) return Promise.resolve();
  if (!opencvLoadPromise) {
    opencvLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = OPENCV_SRC;
      script.async = true;
      script.onload = () => {
        const started = Date.now();
        const poll = () => {
          const cv = (window as unknown as { cv?: CvLike }).cv;
          if (cv && cv.Mat) {
            resolve();
            return;
          }
          if (Date.now() - started > 30_000) {
            opencvLoadPromise = null;
            reject(new Error('OpenCV took too long to initialize.'));
            return;
          }
          window.setTimeout(poll, 100);
        };
        window.setTimeout(poll, 100);
      };
      script.onerror = () => {
        opencvLoadPromise = null;
        reject(new Error('Could not download OpenCV.'));
      };
      document.head.appendChild(script);
    });
  }
  return opencvLoadPromise;
}

export default function CameraScannerModal({
  open,
  onCapture,
  onNativeCapture,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannerRef = useRef<Jscanify | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [opencvReady, setOpencvReady] = useState(false);
  const [opencvFailed, setOpencvFailed] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCameraError(null);
    setOpencvReady(false);
    setOpencvFailed(false);
    setTorchAvailable(false);
    setTorchOn(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Live camera scanning is not supported by this browser. Use your camera app instead.',
      );
      return;
    }

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setCameraError(
            'Camera access was denied. Allow camera permission for this site in your browser settings, then tap Try Again - or use your camera app instead.',
          );
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setCameraError(
            'No usable camera was found on this device. Tap Try Again, or use your camera app instead.',
          );
        } else {
          setCameraError('Could not start the camera. Please try again.');
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        if (caps && caps.torch) setTorchAvailable(true);
      }
      try {
        await loadOpenCV();
        if (!cancelled) setOpencvReady(true);
      } catch {
        if (!cancelled) setOpencvFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, attempt]);

  useEffect(() => {
    if (!open || !opencvReady) return;
    const scanner = new Jscanify();
    scannerRef.current = scanner;
    const scratch = document.createElement('canvas');
    let tick = 0;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      tick += 1;
      if (tick % 2 !== 0) return;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || video.readyState < 2 || !video.videoWidth) {
        return;
      }
      try {
        scratch.width = video.videoWidth;
        scratch.height = video.videoHeight;
        const sctx = scratch.getContext('2d');
        const octx = overlay.getContext('2d');
        if (!sctx || !octx) return;
        sctx.drawImage(video, 0, 0);
        const highlighted = scanner.highlightPaper(scratch);
        if (highlighted) {
          overlay.width = highlighted.width;
          overlay.height = highlighted.height;
          octx.drawImage(highlighted, 0, 0);
        }
      } catch {
        /* skip frame */
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      scannerRef.current = null;
    };
  }, [open, opencvReady]);

  if (!open) return null;

  const grabFrameCanvas = (): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0);
    return canvas;
  };

  const hasAllCorners = (c: Corners): c is Required<Corners> =>
    !!c.topLeftCorner &&
    !!c.topRightCorner &&
    !!c.bottomLeftCorner &&
    !!c.bottomRightCorner;

  const handleShutter = () => {
    if (capturing) return;
    const scanner = scannerRef.current;
    const frame = grabFrameCanvas();
    if (!frame) return;
    setCapturing(true);
    try {
      if (scanner && opencvReady) {
        const cv = (window as unknown as { cv?: CvLike }).cv;
        if (cv && cv.Mat) {
          let mat: { delete?: () => void } | null = null;
          let contour: { delete?: () => void } | null = null;
          try {
            mat = cv.imread(frame) as { delete?: () => void };
            const found = scanner.findPaperContour(mat) as
              | { delete?: () => void }
              | null;
            contour = found;
            if (contour) {
              const corners = scanner.getCornerPoints(contour) as Corners;
              if (hasAllCorners(corners)) {
                const xs = [
                  corners.topLeftCorner.x,
                  corners.topRightCorner.x,
                  corners.bottomLeftCorner.x,
                  corners.bottomRightCorner.x,
                ];
                const ys = [
                  corners.topLeftCorner.y,
                  corners.topRightCorner.y,
                  corners.bottomLeftCorner.y,
                  corners.bottomRightCorner.y,
                ];
                const bboxW = Math.max(...xs) - Math.min(...xs);
                const bboxH = Math.max(...ys) - Math.min(...ys);
                if (bboxW > 0 && bboxH > 0) {
                  const rh = Math.max(
                    1,
                    Math.round((CAPTURE_WIDTH * bboxH) / bboxW),
                  );
                  const extracted = scanner.extractPaper(
                    frame,
                    CAPTURE_WIDTH,
                    rh,
                    corners,
                  );
                  if (extracted && extracted.width > 0 && extracted.height > 0) {
                    onCapture(
                      extracted.toDataURL('image/jpeg', CAPTURE_QUALITY),
                      true,
                    );
                    return;
                  }
                }
              }
            }
          } catch {
            /* fall back to plain extraction */
          } finally {
            contour?.delete?.();
            mat?.delete?.();
          }
          try {
            const rh = Math.max(
              1,
              Math.round((CAPTURE_WIDTH * frame.height) / frame.width),
            );
            const extracted = scanner.extractPaper(frame, CAPTURE_WIDTH, rh);
            if (extracted && extracted.width > 0 && extracted.height > 0) {
              onCapture(
                extracted.toDataURL('image/jpeg', CAPTURE_QUALITY),
                true,
              );
              return;
            }
          } catch {
            /* fall back to raw capture */
          }
        }
      }
      onCapture(frame.toDataURL('image/jpeg', CAPTURE_QUALITY), false);
    } finally {
      setCapturing(false);
    }
  };

  const handleRawCapture = () => {
    if (capturing) return;
    const frame = grabFrameCanvas();
    if (frame) onCapture(frame.toDataURL('image/jpeg', CAPTURE_QUALITY), false);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }],
      } as unknown as MediaTrackConstraints);
      setTorchOn((on) => !on);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="Camera receipt scanner"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-indigo-300" />
          <h3 className="text-base font-bold text-white">Scan Receipt</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close camera scanner"
          className="rounded-full bg-white/10 p-2 text-slate-200 backdrop-blur-md transition hover:bg-white/20 active:bg-white/25"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {cameraError ? (
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Camera size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {cameraError}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 active:scale-[0.98]"
              >
                <Camera size={16} />
                Use Camera App Instead
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="block max-h-full max-w-full rounded-2xl"
            />
            <canvas
              ref={overlayRef}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
            />
            {!opencvReady && (
              <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-md">
                {opencvFailed ? (
                  <AlertTriangle size={12} className="text-amber-300" />
                ) : (
                  <Loader2 size={12} className="animate-spin" />
                )}
                {opencvFailed
                  ? 'Auto-crop unavailable'
                  : 'Loading edge detection...'}
              </div>
            )}
          </div>
        )}
      </div>

      {!cameraError && (
        <p className="px-4 pb-2 pt-3 text-center text-xs font-medium text-slate-300">
          {opencvReady
            ? 'Align the receipt inside the highlighted frame, then tap Capture.'
            : 'Point the camera at your receipt.'}
        </p>
      )}

      <div className="flex items-center justify-center gap-8 px-4 pb-8 pt-2">
        <button
          type="button"
          onClick={handleRawCapture}
          disabled={capturing}
          aria-label="Capture without auto-crop"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-slate-200 backdrop-blur-md transition hover:bg-white/20 active:scale-95 disabled:opacity-40"
        >
          <ImageIcon size={20} />
        </button>
        <button
          type="button"
          onClick={handleShutter}
          disabled={capturing}
          aria-label="Capture receipt"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-950/50 ring-4 ring-white/80 transition hover:bg-indigo-500 active:scale-95 disabled:opacity-40"
        >
          {capturing ? (
            <Loader2 size={26} className="animate-spin" />
          ) : (
            <Camera size={26} />
          )}
        </button>
        {torchAvailable ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            disabled={capturing}
            aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
            className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 disabled:opacity-40 ${
              torchOn
                ? 'bg-amber-400 text-slate-900'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <Zap size={20} />
          </button>
        ) : (
          <span className="h-12 w-12" />
        )}
      </div>

      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onNativeCapture(file);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
