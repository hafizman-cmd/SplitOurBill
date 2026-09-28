import jsQR from 'jsqr';
import type { HistoryEntry } from '../types';

export const STORAGE_KEY = 'kira-kira.bank-details';
export const QR_STORAGE_KEY = 'kira-kira.payment-qr-code';
export const QR_PAYLOAD_STORAGE_KEY = 'kira-kira.qr-payload';
export const HISTORY_STORAGE_KEY = 'kira_kira_history';
export const ACTIVE_BILL_STORAGE_KEY = 'kira_kira_active_bill';

export const formatRM = (n: number) => `RM ${n.toFixed(2)}`;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const compressImage = (file: File, maxDim = 800): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not process the image.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

const QR_TARGET_DIMS = [1, 800, 1600];

const decodeQrText = (img: HTMLImageElement, scale: number): string | null => {
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    return (
      jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null
    );
  } catch {
    return null;
  }
};

const readQrFromSource = (src: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const long = Math.max(img.width, img.height) || 1;
        const scales = Array.from(
          new Set(
            QR_TARGET_DIMS.map((target) => target / long).filter(
              (s) => s >= 0.1 && s <= 8,
            ),
          ),
        );
        for (const scale of scales) {
          const text = decodeQrText(img, scale);
          if (text && text.startsWith('0002')) {
            resolve(text);
            return;
          }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

export const readQrPayload = (dataUrl: string): Promise<string | null> =>
  readQrFromSource(dataUrl);

export const readQrPayloadFromFile = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      void readQrFromSource(String(reader.result)).then(resolve);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

export function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is HistoryEntry => {
      if (typeof e !== 'object' || e === null) return false;
      const entry = e as Record<string, unknown>;
      return (
        typeof entry.id === 'string' &&
        typeof entry.date === 'string' &&
        typeof entry.restaurantName === 'string' &&
        typeof entry.grandTotal === 'number' &&
        typeof entry.itemsCount === 'number' &&
        typeof entry.receiptData === 'object' &&
        entry.receiptData !== null &&
        Array.isArray((entry.receiptData as Record<string, unknown>).items)
      );
    });
  } catch {
    return [];
  }
}
