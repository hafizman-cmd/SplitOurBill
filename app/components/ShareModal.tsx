'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Link, MessageCircle, Share2, X } from 'lucide-react';
import type { SplitResult } from '../types';
import type { SharedBill } from '../lib/sharedBill';
import { buildShareText } from '../lib/split';
import Modal from './Modal';

type Props = {
  bill: SharedBill;
  calc: SplitResult;
  onClose: () => void;
};

export default function ShareModal({ bill, calc, onClose }: Props) {
  const [url, setUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [notice, setNotice] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const request = useRef<AbortController | null>(null);
  const text = buildShareText(calc, bill.people, bill.bankDetails, bill.currency, bill.myrRate);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const buttonClass = 'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold';

  useEffect(() => () => request.current?.abort(), []);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(label);
      setManualCopy('');
    } catch {
      setNotice('Clipboard unavailable. Select and copy the text below.');
      setManualCopy(value);
    }
  };

  const createLink = async () => {
    if (request.current || url) return;
    const controller = new AbortController();
    request.current = controller;
    setCreating(true);
    setLinkError('');
    try {
      const response = await fetch('/api/shared-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bill),
        signal: controller.signal,
      });
      if (response.status === 429) {
        setLinkError('Too many links created. Try again in a minute.');
      } else if (response.status === 413) {
        setLinkError('This bill is too large for a link. You can still share the split.');
      } else {
        if (!response.ok) throw new Error('Share link request failed');
        const { id } = await response.json();
        if (typeof id !== 'string' || !id) throw new Error('Share link ID missing');
        setUrl(`${window.location.origin}/view/${encodeURIComponent(id)}`);
      }
    } catch {
      if (!controller.signal.aborted) setLinkError('Couldn’t create the link. You can still copy the split or share it via WhatsApp.');
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setCreating(false);
    }
  };

  const openWhatsApp = () => {
    const message = buildShareText(calc, bill.people, bill.bankDetails, bill.currency, bill.myrRate, url, 'whatsapp');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'Kira-Kira Bill Split', text, url: url || undefined });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice('Sharing failed. You can still copy the split.');
    }
  };

  return (
    <Modal onClose={onClose} className="sheet-overlay" onClick={onClose} aria-labelledby="share-bill-title">
      <div className="glass-card sheet-panel w-full max-w-md p-6 text-slate-100" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 id="share-bill-title" className="text-lg font-bold text-white">Share bill</h3>
          <button type="button" onClick={onClose} aria-label="Close share" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          <button type="button" data-autofocus onClick={() => void copy(text, 'Split copied.')} className={`${buttonClass} bg-blue-700 text-white hover:bg-blue-600`}>
            <Copy size={16} />Copy split
          </button>
          <button type="button" onClick={openWhatsApp} className={`${buttonClass} border border-emerald-400/35 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`}>
            <MessageCircle size={16} />Share via WhatsApp
          </button>
          {canShare && <button type="button" onClick={() => void nativeShare()} className={`${buttonClass} border border-white/15 hover:bg-white/10`}>
            <Share2 size={16} />More sharing options
          </button>}
        </div>
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          <p className="text-sm text-slate-300">Anyone with the link can open the split and any included payment details for 3 days.</p>
          {url ? (
            <>
              <p className="break-all rounded-lg bg-white/5 p-3 text-sm">{url}</p>
              <button type="button" onClick={() => void copy(url, 'Link copied.')} className={`${buttonClass} border border-white/15 hover:bg-white/10`}>
                <Link size={16} />Copy link
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void createLink()} disabled={creating} aria-busy={creating} className={`${buttonClass} border border-white/15 hover:bg-white/10 disabled:opacity-60`}>
              <Link size={16} />{creating ? 'Creating link…' : 'Create link'}
            </button>
          )}
          {linkError && <p role="alert" className="text-sm text-amber-200">{linkError}</p>}
        </div>
        <p role="status" className={notice ? 'mt-3 text-sm text-slate-300' : 'sr-only'}>{notice}</p>
        {manualCopy && <textarea aria-label="Text to copy" readOnly rows={5} value={manualCopy} onFocus={(event) => event.target.select()} className="glass-input mt-2 w-full text-sm" />}
      </div>
    </Modal>
  );
}
