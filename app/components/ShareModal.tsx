'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link, MessageCircle, Share2, X } from 'lucide-react';

type Props = {
  open: boolean;
  url: string;
  text: string;
  onClose: () => void;
  onNotify: (message: string) => void;
};

type CopyKey = 'link' | 'text';

export default function ShareModal({
  open,
  url,
  text,
  onClose,
  onNotify,
}: Props) {
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopied(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  if (!open) return null;

  const flashCopied = (key: CopyKey) => {
    setCopied(key);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 1800);
  };

  const copyValue = async (key: CopyKey, value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(key);
      onNotify(message);
    } catch {
      onNotify('Copy failed. Please try again.');
    }
  };

  const openWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const shareNatively = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Kira-Kira Bill Split', text });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        onNotify('Sharing failed. Please copy the link instead.');
      }
    } else {
      await copyValue('text', text, 'Summary copied to clipboard');
    }
  };

  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share bill"
    >
      <div
        className="glass-card w-full max-w-md p-6 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Share Bill</h3>
          <button
            onClick={onClose}
            aria-label="Close share"
            className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slate-300">
          Anyone with this link can view the full breakdown and settle via
          DuitNow - no account needed.
        </p>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
          <div className="flex items-start gap-2">
            <Link className="mt-0.5 w-4 h-4 shrink-0 text-blue-500" />
            <p className="min-w-0 break-all font-mono text-[11px] leading-relaxed text-slate-300">
              {url}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void copyValue('link', url, 'Interactive link copied')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            {copied === 'link' ? (
              <Check className="w-4 h-4" />
            ) : (
              <Link className="w-4 h-4" />
            )}
            {copied === 'link' ? 'Link Copied' : 'Copy Interactive Link'}
          </button>

          <button
            type="button"
            onClick={openWhatsApp}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4" />
            Share via WhatsApp
          </button>

          <button
            type="button"
            onClick={() => void shareNatively()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 active:scale-[0.98]"
          >
            {canShare ? (
              <>
                <Share2 className="w-4 h-4" />
                More Sharing Options
              </>
            ) : (
              <>
                {copied === 'text' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied === 'text' ? 'Summary Copied' : 'Copy Summary Text'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
