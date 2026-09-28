'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Crop, Loader2, X } from 'lucide-react';

type Props = {
  open: boolean;
  imageSrc: string;
  onCrop: (dataUrl: string) => void;
  onSkip: () => void;
  onClose: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };

type DragMode = 'move' | 'new' | 'nw' | 'ne' | 'sw' | 'se';

type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  startRect: Rect;
  anchorX: number;
  anchorY: number;
  baseW: number;
  baseH: number;
};

const MIN_SIZE = 0.06;
const DEFAULT_RECT: Rect = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export default function CropModal({
  open,
  imageSrc,
  onCrop,
  onSkip,
  onClose,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setRect(DEFAULT_RECT);
  }, [open, imageSrc]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - drag.startX) / drag.baseW;
      const dy = (e.clientY - drag.startY) / drag.baseH;
      const s = drag.startRect;
      let next: Rect;
      switch (drag.mode) {
        case 'move':
          next = {
            ...s,
            x: clamp(s.x + dx, 0, 1 - s.w),
            y: clamp(s.y + dy, 0, 1 - s.h),
          };
          break;
        case 'new': {
          const px = clamp(drag.anchorX + dx, 0, 1);
          const py = clamp(drag.anchorY + dy, 0, 1);
          const x = Math.min(drag.anchorX, px);
          const y = Math.min(drag.anchorY, py);
          next = {
            x,
            y,
            w: clamp(Math.abs(px - drag.anchorX), MIN_SIZE, 1 - x),
            h: clamp(Math.abs(py - drag.anchorY), MIN_SIZE, 1 - y),
          };
          break;
        }
        case 'nw': {
          const x = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
          const y = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
          next = { x, y, w: s.x + s.w - x, h: s.y + s.h - y };
          break;
        }
        case 'ne': {
          const y = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
          const w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
          next = { x: s.x, y, w, h: s.y + s.h - y };
          break;
        }
        case 'sw': {
          const x = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
          const h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
          next = { x, y: s.y, w: s.x + s.w - x, h };
          break;
        }
        default: {
          const w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
          const h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
          next = { x: s.x, y: s.y, w, h };
          break;
        }
      }
      setRect(next);
    };
    const onUp = (e: PointerEvent) => {
      const moved =
        Math.abs(e.clientX - drag.startX) >= 3 ||
        Math.abs(e.clientY - drag.startY) >= 3;
      if (drag.mode === 'new' && !moved) setRect(drag.startRect);
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag]);

  if (!open) return null;

  const beginDrag = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = overlayRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    setDrag({
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startRect: rect,
      anchorX: clamp((e.clientX - box.left) / box.width, 0, 1),
      anchorY: clamp((e.clientY - box.top) / box.height, 0, 1),
      baseW: box.width,
      baseH: box.height,
    });
  };

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      onSkip();
      return;
    }
    setProcessing(true);
    try {
      const sx = Math.round(rect.x * img.naturalWidth);
      const sy = Math.round(rect.y * img.naturalHeight);
      const sw = Math.max(1, Math.round(rect.w * img.naturalWidth));
      const sh = Math.max(1, Math.round(rect.h * img.naturalHeight));
      const scale = Math.min(1, 1600 / Math.max(sw, sh));
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
      onCrop(canvas.toDataURL('image/jpeg', 0.92));
    } catch {
      setProcessing(false);
      onSkip();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Crop receipt"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crop size={18} className="text-indigo-600" />
            <h3 className="text-base font-bold text-slate-800">Crop Receipt</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cropper"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Drag the corners to trim the photo down to the receipt text, or drag on
          the image to select a new area.
        </p>

        <div className="flex flex-1 justify-center overflow-hidden">
          <div className="relative">
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Receipt to crop"
              draggable={false}
              className="block max-h-[45vh] max-w-full select-none"
            />
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair touch-none overflow-hidden"
              onPointerDown={(e) => beginDrag('new', e)}
            >
              <div
                className="absolute cursor-move border-2 border-white"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
                }}
                onPointerDown={(e) => beginDrag('move', e)}
              >
                <span
                  className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-indigo-600"
                  onPointerDown={(e) => beginDrag('nw', e)}
                />
                <span
                  className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-sm border-2 border-white bg-indigo-600"
                  onPointerDown={(e) => beginDrag('ne', e)}
                />
                <span
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-sm border-2 border-white bg-indigo-600"
                  onPointerDown={(e) => beginDrag('sw', e)}
                />
                <span
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-indigo-600"
                  onPointerDown={(e) => beginDrag('se', e)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={processing}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check size={16} />
            Skip Cropping
          </button>
          <button
            type="button"
            onClick={handleCrop}
            disabled={processing}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {processing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Crop size={16} />
            )}
            Crop &amp; Scan
          </button>
        </div>
      </div>
    </div>
  );
}
