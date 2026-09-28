import type { HistoryEntry } from '../types';

export const STORAGE_KEY = 'kira-kira.bank-details';
export const QR_STORAGE_KEY = 'kira-kira.payment-qr-code';
export const HISTORY_STORAGE_KEY = 'kira_kira_history';

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
