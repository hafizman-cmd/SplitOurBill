'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  QrCode,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { decodeBillFromUrl, type SharedBill } from '../lib/urlState';
import { formatMoney, formatMyrEquivalent } from '../lib/currency';
import { findAccountNumber } from '../lib/split';
import Footer from '../components/Footer';

type Flash = { key: string; ok: boolean } | null;

export default function ViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-6 py-4 text-xs font-semibold text-slate-400 shadow-sm backdrop-blur-md">
            Opening shared bill...
          </div>
        </div>
      }
    >
      <GuestBillView />
    </Suspense>
  );
}

function GuestBillView() {
  const searchParams = useSearchParams();
  const [bill, setBill] = useState<SharedBill | null | undefined>(undefined);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBill(decodeBillFromUrl(searchParams.get('b')));
  }, [searchParams]);

  useEffect(() => {
    if (!qrExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [qrExpanded]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (bill && bill.people.length === 1) setSelected(bill.people[0]);
  }, [bill]);

  const money = (n: number) => (bill ? formatMoney(n, bill.currency) : '');
  const eq = (n: number) =>
    bill ? formatMyrEquivalent(n, bill.currency, bill.myrRate) : null;

  const filteredPeople = useMemo(() => {
    if (!bill) return [];
    const q = query.trim().toLowerCase();
    if (!q) return bill.people;
    return bill.people.filter((p) => p.toLowerCase().includes(q));
  }, [bill, query]);

  const dateLabel = useMemo(() => {
    if (!bill?.date) return '';
    const d = new Date(bill.date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [bill?.date]);

  const entry = bill && selected ? bill.perPerson[selected] : undefined;

  const accountNumber = useMemo(
    () => (bill ? findAccountNumber(bill.bankDetails) : null),
    [bill],
  );

  const settlementAmount = useMemo(() => {
    if (!bill || !entry) return null;
    if (bill.currency === 'MYR') return `RM ${entry.final.toFixed(2)}`;
    if (Number.isFinite(bill.myrRate) && bill.myrRate > 0) {
      return `RM ${(entry.final * bill.myrRate).toFixed(2)}`;
    }
    return formatMoney(entry.final, bill.currency);
  }, [bill, entry]);

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setFlash({ key, ok: true });
    } catch {
      setFlash({ key, ok: false });
    }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2000);
  };

  const forwardBalance = () => {
    if (!bill || !entry) return;
    const shareText = eq(entry.final)
      ? `${money(entry.final)} (${eq(entry.final)} for DuitNow)`
      : money(entry.final);
    const text = `Hi! My share for ${bill.restaurantName} is ${shareText}. Split with Kira-Kira.`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  if (bill === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-6 py-4 text-xs font-semibold text-slate-400 shadow-sm backdrop-blur-md">
          Opening shared bill...
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card w-full max-w-sm p-6 text-center">
          <h1 className="text-base font-bold text-slate-800">
            This link can&apos;t be opened
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            The shared bill link looks incomplete or corrupted. Ask your host
            to share it again.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-xs font-medium text-white shadow-lg shadow-blue-500/25 transition hover:brightness-110 active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Go to Kira-Kira
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-100 antialiased">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-transparent">
        <header className="glass-nav sticky top-3 z-50 mx-4 my-3 flex items-center gap-3 px-4 py-3 text-white">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20 text-blue-100">
            <ShieldCheck size={20} strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight">
              {bill.restaurantName}
            </h1>
            <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-slate-400">
              {dateLabel ? `${dateLabel} - ` : ''}Shared by your host
            </p>
          </div>
        </header>

        <main className="space-y-5 px-4 pb-6 pt-2">
          <section className="glass-card p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Bill Total
            </h2>
            <p className="mt-1 text-3xl font-bold text-white">
              {money(bill.grandTotal)}
            </p>
            {eq(bill.grandTotal) && (
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                {eq(bill.grandTotal)} for DuitNow
              </p>
            )}
            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(bill.subtotal)}</span>
              </div>
              {bill.serviceCharge > 0 && (
                <div className="flex justify-between">
                  <span>Service charge ({bill.serviceCharge}%)</span>
                  <span>{money(bill.serviceAmt)}</span>
                </div>
              )}
              {bill.tax > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({bill.tax}%)</span>
                  <span>{money(bill.taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Split between</span>
                <span>{bill.people.length} people</span>
              </div>
            </div>
          </section>

          <section className="glass-card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Find your name
            </h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your name"
                aria-label="Search your name"
                className="glass-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredPeople.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    selected === p
                    ? 'border-blue-500/40 bg-blue-600/20 text-blue-400 shadow-sm'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  {p}
                </button>
              ))}
              {filteredPeople.length === 0 && (
                <p className="text-xs text-slate-400">
                  No matching name. Check with your host.
                </p>
              )}
            </div>
          </section>

          {entry && (
            <section className="glass-card p-5">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                {selected}&apos;s share
              </h2>
              <div className="mt-2 space-y-1.5">
                {entry.items.length > 0 ? (
                  entry.items.map((it, i) => (
                    <div
                      key={`${it.name}-${i}`}
                      className="flex justify-between gap-3 text-sm text-slate-300"
                    >
                      <span className="min-w-0 truncate">{it.name}</span>
                      <span className="shrink-0 font-medium">
                        {money(it.share)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">
                    No items assigned to this person.
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-sm font-bold text-white">
                  Total to pay
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold leading-tight text-blue-400">
                    {money(entry.final)}
                  </span>
                  {eq(entry.final) && (
                    <span className="block text-[11px] font-medium text-slate-400">
                      {eq(entry.final)} for DuitNow
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={forwardBalance}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/25 bg-emerald-400/10 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/20 active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4" />
                Forward My Balance
              </button>
            </section>
          )}

          {(bill.bankDetails.trim() !== '' || bill.qrPayload !== '') && (
            <section className="glass-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
                  Settle via DuitNow
                </h2>
              </div>

              {bill.qrPayload && (
                <button
                  type="button"
                  onClick={() => setQrExpanded(true)}
                  aria-label="Enlarge DuitNow QR code"
                  className="mb-3 flex w-full flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-md transition hover:border-white/20 active:scale-[0.98]"
                >
                  <span className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <QrCode className="w-4 h-4" />
                    Scan to pay via DuitNow
                  </span>
                  <span className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
                    <QRCodeSVG value={bill.qrPayload} size={180} />
                  </span>
                  <span className="mt-2 text-[10px] font-medium text-slate-400">
                    Tap to enlarge
                  </span>
                </button>
              )}

              {bill.bankDetails.trim() !== '' && (
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-3 text-sm leading-relaxed text-slate-300">
                  {bill.bankDetails
                    .split('\n')
                    .filter((line) => line.trim() !== '')
                    .map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              )}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {accountNumber && (
                  <CopyButton
                    flashKey="account"
                    label="Copy Account Number"
                    value={accountNumber}
                    flash={flash}
                    onCopy={copyValue}
                  />
                )}
                {settlementAmount && (
                  <CopyButton
                    flashKey="amount"
                    label={`Copy Amount (${settlementAmount})`}
                    value={settlementAmount}
                    flash={flash}
                    onCopy={copyValue}
                  />
                )}
              </div>
            </section>
          )}

          <p className="pt-1 text-center text-[11px] text-slate-400">
            Read-only view shared via Kira-Kira
          </p>
        </main>

        <footer className="mt-auto px-4 pb-6 pt-2 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:text-blue-400"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Split your own bill with Kira-Kira
          </Link>
        </footer>

        <Footer />

        {qrExpanded && bill.qrPayload && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm"
            onClick={() => setQrExpanded(false)}
            role="dialog"
            aria-modal="true"
            aria-label="DuitNow QR code"
          >
            <div
              className="glass-card w-full max-w-xs p-6 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-fit rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <QRCodeSVG value={bill.qrPayload} size={280} />
              </div>
              <p className="mt-4 text-center text-xs font-medium leading-relaxed text-slate-500">
                Scan with your banking app to pay
                {settlementAmount ? ` ${settlementAmount}` : ''}
              </p>
              <button
                type="button"
                onClick={() => setQrExpanded(false)}
                className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({
  flashKey,
  label,
  value,
  flash,
  onCopy,
}: {
  flashKey: string;
  label: string;
  value: string;
  flash: Flash;
  onCopy: (key: string, value: string) => void;
}) {
  const active = flash?.key === flashKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(flashKey, value)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition active:scale-95 ${
        active
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
          : 'border-slate-300 bg-white text-slate-600 shadow-sm hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      {active ? (
        flash?.ok ? (
          <>
            <Check className="w-4 h-4 text-emerald-500" />
            Copied
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-rose-500" />
            Couldn&apos;t copy
          </>
        )
      ) : (
        <>
          <Copy className="w-4 h-4 text-slate-400" />
          {label}
        </>
      )}
    </button>
  );
}
