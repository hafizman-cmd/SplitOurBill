'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Camera,
  Check,
  Crop,
  Loader2,
  RefreshCw,
  RotateCw,
  X,
  Zap,
} from 'lucide-react';

type Props = {
  open: boolean;
  onCapture: (dataUrl: string) => void;
  onNativeCapture: (file: File) => void;
  onClose: () => void;
};

type Phase = 'viewfinder' | 'review';

const CAPTURE_QUALITY = 0.92;
const MAX_OUTPUT_DIM = 1600;
const DEFAULT_CROP: PercentCrop = {
  unit: '%',
  x: 5,
  y: 5,
  width: 90,
  height: 90,
};

const cropStyle = {
  '--rc-drag-handle-size': '16px',
  '--rc-drag-handle-mobile-size': '34px',
  '--rc-drag-bar-size': '14px',
  '--rc-border-color': 'rgba(255, 255, 255, 0.95)',
} as CSSProperties;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the captured image.'));
    img.src = src;
  });
}

export default function CameraModal({
  open,
  onCapture,
  onNativeCapture,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('viewfinder');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<PercentCrop>(DEFAULT_CROP);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

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
    setPhase('viewfinder');
    setCapturedUrl(null);
    setCrop(DEFAULT_CROP);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'viewfinder') return;
    let cancelled = false;
    setCameraError(null);
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
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        if (caps && caps.torch) setTorchAvailable(true);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, phase, attempt]);

  if (!open) return null;

  const inReview = phase === 'review';

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL('image/jpeg', CAPTURE_QUALITY);
    stopStream();
    setCapturedUrl(url);
    setCrop(DEFAULT_CROP);
    setPhase('review');
  };

  const handleRotate = async () => {
    if (!capturedUrl || busy) return;
    setBusy(true);
    try {
      const img = await loadImage(capturedUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable.');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setCapturedUrl(canvas.toDataURL('image/jpeg', CAPTURE_QUALITY));
      setCrop(DEFAULT_CROP);
    } catch {
      /* keep the current frame */
    } finally {
      setBusy(false);
    }
  };

  const handleRetake = () => {
    setCapturedUrl(null);
    setCrop(DEFAULT_CROP);
    setPhase('viewfinder');
  };

  const handleUsePhoto = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight || !capturedUrl) return;
    setBusy(true);
    try {
      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (crop.width > 0 && crop.height > 0) {
        sx = Math.round((crop.x / 100) * img.naturalWidth);
        sy = Math.round((crop.y / 100) * img.naturalHeight);
        sw = Math.max(1, Math.round((crop.width / 100) * img.naturalWidth));
        sh = Math.max(1, Math.round((crop.height / 100) * img.naturalHeight));
      }
      const scale = Math.min(1, MAX_OUTPUT_DIM / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
      onCapture(canvas.toDataURL('image/jpeg', CAPTURE_QUALITY));
    } catch {
      onCapture(capturedUrl);
    } finally {
      setBusy(false);
    }
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
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {inReview ? (
            <Crop className="h-5 w-5 text-[#007AFF]" />
          ) : (
            <Camera className="h-5 w-5 text-[#007AFF]" />
          )}
          <h3 className="text-base font-bold text-white">
            {inReview ? 'Adjust & Crop' : 'Scan Receipt'}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close camera scanner"
          className="rounded-full border border-white/10 bg-white/10 p-2 text-slate-200 backdrop-blur-xl transition hover:bg-white/20 active:bg-white/25"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {inReview ? (
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
          <div className="flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-2 backdrop-blur-xl">
            {capturedUrl && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                keepSelection
                ruleOfThirds
                style={cropStyle}
              >
                <img
                  ref={imgRef}
                  src={capturedUrl}
                  alt="Captured receipt to crop"
                  draggable={false}
                  className="block max-h-[58vh] max-w-full select-none"
                />
              </ReactCrop>
            )}
          </div>
        </div>
      ) : cameraError ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center backdrop-blur-xl">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <Camera className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-100">{cameraError}</p>
            <div className="mt-4 grid w-full grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#007AFF]/30 transition hover:brightness-110 active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 py-2.5 text-sm font-semibold text-slate-100 backdrop-blur-xl transition hover:bg-white/20 active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" />
                Use Camera App Instead
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-3/5 w-4/5 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-dashed border-blue-400/50" />
        </div>
      )}

      {inReview ? (
        <>
          <p className="px-4 pb-2 pt-3 text-center text-xs font-medium text-slate-300">
            Drag the corner handles to crop the receipt, rotate it upright, or
            retake the photo.
          </p>
          <div className="flex items-center justify-center gap-6 px-4 pb-8 pt-2">
            <button
              type="button"
              onClick={() => void handleRotate()}
              disabled={busy}
              aria-label="Rotate image 90 degrees clockwise"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-900/90 text-slate-200 backdrop-blur-xl transition hover:bg-white/10 active:scale-95 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RotateCw className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleRetake}
              disabled={busy}
              aria-label="Retake photo"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-900/90 text-slate-200 backdrop-blur-xl transition hover:bg-white/10 active:scale-95 disabled:opacity-40"
            >
              <Camera className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleUsePhoto}
              disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-6 text-sm font-semibold text-white shadow-lg shadow-[#007AFF]/30 transition hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              Use Photo
            </button>
          </div>
        </>
      ) : !cameraError ? (
        <>
          <p className="px-4 pb-2 pt-3 text-center text-xs font-medium text-slate-300">
            Align the receipt inside the frame, then tap Take Photo.
          </p>
          <div className="flex items-center justify-center gap-8 px-4 pb-8 pt-2">
            {torchAvailable ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
                className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition active:scale-95 ${
                  torchOn
                    ? 'bg-amber-400 text-slate-900'
                    : 'bg-slate-900/90 text-slate-200 hover:bg-white/10'
                }`}
              >
                <Zap className="h-5 w-5" />
              </button>
            ) : (
              <span className="h-12 w-12" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={handleTakePhoto}
              aria-label="Take photo"
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#007AFF] px-8 text-sm font-semibold text-white shadow-lg shadow-[#007AFF]/30 transition hover:brightness-110 active:scale-95"
            >
              <Camera className="h-5 w-5" />
              Take Photo
            </button>
            <span className="h-12 w-12" aria-hidden="true" />
          </div>
        </>
      ) : null}

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
