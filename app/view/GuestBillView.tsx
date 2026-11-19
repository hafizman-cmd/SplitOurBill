'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Modal from '../components/Modal';
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
import type { SharedBill } from '../lib/sharedBill';
import { currencyDecimalPlaces, formatMoney, formatMyrEquivalent } from '../lib/currency';
import { findAccountNumber } from '../lib/split';
import { KiraKiraLogo } from '../components/ui/logo';
import { logEvent } from '@/lib/telemetry';

type Flash = { key: string; ok: boolean } | null;

export default function GuestBillView({ bill }: { bill: SharedBill }) {
  const [selected, setSelected] = useState(bill.people.length === 1 ? bill.people[0] : '');
  const [query, setQuery] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      logEvent('app_open');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const money = (n: number) => formatMoney(n, bill.currency);
  const eq = (n: number) => formatMyrEquivalent(n, bill.currency, bill.myrRate);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bill.people;
    return bill.people.filter((p) => p.toLowerCase().includes(q));
  }, [bill, query]);

  const dateLabel = useMemo(() => {
    const d = new Date(bill.date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [bill.date]);

  const entry = selected ? bill.perPerson[selected] : undefined;
  const bankDetails = bill.bankDetails.trim();
  const hasPaymentDetails = Boolean(bankDetails || bill.qrPayload);
  const hasBalance = Boolean(entry && entry.final > 0);

  const accountNumber = useMemo(
    () => findAccountNumber(bill.bankDetails),
    [bill.bankDetails],
  );

  const myrAmount = entry ? entry.final * (bill.currency === 'MYR' ? 1 : bill.myrRate) : 0;
  const amountInMyr = Number.isFinite(myrAmount) && Number(myrAmount.toFixed(2)) > 0 ? myrAmount.toFixed(2) : null;
  const settlementAmount = amountInMyr ? `RM ${amountInMyr}` : null;
  const paymentInstruction = settlementAmount
    ? `Check the recipient and amount in your banking app. If it asks for an amount, enter ${settlementAmount}.`
    : 'Confirm the amount in RM with your host before paying.';

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
    if (!entry) return;
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-start gap-4 bg-transparent px-4 pb-8 pt-4 text-slate-100 antialiased">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-start gap-4 bg-transparent">
        <header className="glass-nav sticky top-3 z-50 my-3 flex w-full items-center gap-3 px-4 py-3 text-white">
          <KiraKiraLogo className="h-10 w-10" />
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-white">Kira-Kira</p>
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight">{bill.restaurantName}</h1>
            <p className="mt-0.5 truncate text-sm font-medium tracking-wide text-slate-300">
              {dateLabel ? `${dateLabel} - ` : ''}Shared by your host
            </p>
          </div>
        </header>

        <main className="w-full pb-8 pt-2">
          <div className="flex w-full flex-col gap-4 sm:gap-5">
          <section className="bill-panel p-5">
            <h2 className="text-lg font-semibold text-white">Find Your Name</h2>
            <p className="mb-3 mt-1 text-sm text-slate-300">Choose your name to see your share and how to pay.</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-300" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your name"
                aria-label="Search your name"
                className="glass-input w-full rounded-xl py-2.5 pl-10 pr-4 text-base outline-none transition"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredPeople.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setSelected(p); setFlash(null); setQrExpanded(false); }}
                  aria-pressed={selected === p}
                  className={`min-h-11 rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
                    selected === p
                    ? 'border-blue-400/40 bg-blue-600/20 text-blue-100 shadow-sm'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  {p}
                </button>
              ))}
              {filteredPeople.length === 0 && (
                <p className="text-sm text-slate-300">
                  No matching name. Check with your host.
                </p>
              )}
            </div>
          </section>

          {entry && (
            <section aria-label={`${selected}'s share and payment details`} className="bill-panel p-5">
              <div aria-live="polite">
                <h2 className="text-sm font-semibold text-slate-200">{selected}&apos;s share</h2>
                <p className="mt-3 text-sm text-blue-200">Total to Pay</p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-white tabular-nums">{money(entry.final)}</p>
                {bill.currency !== 'MYR' && settlementAmount && <p className="mt-1 text-sm font-semibold text-blue-200">Approximately {settlementAmount} for DuitNow</p>}
              </div>

              {!hasBalance && <p className="mt-3 text-sm text-slate-300">No payment is due for your share.</p>}
              {hasBalance && !hasPaymentDetails && (
                <p className="mt-3 text-sm text-slate-300">Your host hasn&apos;t added payment details. Ask them how to transfer your share.</p>
              )}

              {hasBalance && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  {hasPaymentDetails && <h3 className="font-semibold text-slate-100">Pay your host via DuitNow</h3>}
                  {bankDetails && <p className="whitespace-pre-line break-words rounded-xl bg-slate-950/40 p-3 text-sm leading-relaxed text-slate-200">{bankDetails}</p>}
                  {(amountInMyr || !hasPaymentDetails || accountNumber) && (
                    <div className="flex flex-wrap gap-2">
                      {(amountInMyr || !hasPaymentDetails) && <CopyButton flashKey="amount" label={`Copy ${settlementAmount ?? money(entry.final)}`} value={amountInMyr ?? entry.final.toFixed(currencyDecimalPlaces(bill.currency))} flash={flash} onCopy={copyValue} />}
                      {accountNumber && <CopyButton flashKey="account" label="Copy account number" value={accountNumber.replace(/\D/g, '')} flash={flash} onCopy={copyValue} />}
                    </div>
                  )}
                  {hasPaymentDetails && <p className="text-sm leading-relaxed text-slate-300">{paymentInstruction}</p>}
                  {bill.qrPayload && (
                    <div className="space-y-3 rounded-2xl bg-slate-950/40 p-4">
                      <div className="mx-auto w-fit max-w-full rounded-xl bg-white p-3"><QRCodeSVG value={bill.qrPayload} size={168} className="h-auto max-w-full" /></div>
                      <button type="button" onClick={() => setQrExpanded(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600">
                        <QrCode aria-hidden="true" size={16} /> Enlarge DuitNow QR
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {hasBalance && (
            <div className="flex items-start justify-center gap-1.5 px-4 text-center text-sm text-slate-300">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span>
                Pay in your bank&apos;s official app. Your host marks payments manually.
              </span>
            </div>
          )}

          {entry && (
            <section className="bill-panel p-5">
              <details>
                <summary className="cursor-pointer min-h-11 py-3 text-base font-semibold text-slate-200">{selected}&apos;s item breakdown ({entry.items.length})</summary>
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
                  <p className="text-sm text-slate-300">
                    No items assigned to this person.
                  </p>
                )}
              </div>
                <p className="mt-3 border-t border-white/10 pt-3 text-sm text-slate-300">Item shares are shown before charges and rounding. The total to pay above includes these extras.</p>
              </details>
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

          <details className="bill-panel p-5">
            <summary className="cursor-pointer min-h-11 py-3 text-base font-semibold text-slate-200">View full bill details</summary>
            <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <dl className="grid gap-y-2 text-sm text-slate-300 [&>div]:flex [&>div]:justify-between [&>div]:gap-x-3 [&_dd]:min-w-0 [&_dd]:text-right [&_dd]:tabular-nums [&_dd]:[overflow-wrap:anywhere]">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(bill.subtotal)}</dd>
                </div>
                {bill.serviceCharge > 0 && (
                  <div>
                    <dt>Service Charge ({bill.serviceCharge}%)</dt>
                    <dd>{money(bill.serviceAmt)}</dd>
                  </div>
                )}
                {bill.tax > 0 && (
                  <div>
                    <dt>Tax ({bill.tax}%)</dt>
                    <dd>{money(bill.taxAmt)}</dd>
                  </div>
                )}
                {bill.discount != null && bill.discount > 0 && (
                  <div>
                    <dt>Discount</dt>
                    <dd>-{money(bill.discount)}</dd>
                  </div>
                )}
                {bill.roundingAdjustment !== 0 && (
                  <div>
                    <dt>Rounding Adjustment</dt>
                    <dd>
                      {bill.roundingAdjustment > 0 ? '+' : '-'}
                      {money(Math.abs(bill.roundingAdjustment))}
                    </dd>
                  </div>
                )}
                <div className="mt-1 flex-wrap items-baseline gap-y-1 border-t border-dashed border-white/25 pt-3">
                  <dt className="font-semibold text-white">Bill total</dt>
                  <dd className="ml-auto">
                    <p className="text-2xl font-bold tracking-tight text-white">{money(bill.grandTotal)}</p>
                    {eq(bill.grandTotal) && (
                      <p className="mt-0.5 text-sm font-medium text-slate-300">
                        {eq(bill.grandTotal)} for DuitNow
                      </p>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-300">
                Split between {bill.people.length} {bill.people.length === 1 ? 'person' : 'people'}
              </p>
            </div>
          </details>

          <p className="pt-1 text-center text-sm text-slate-300">
            Read-only view shared via Kira-Kira
          </p>
          </div>
        </main>

        <footer className="px-4 pb-6 pt-2 text-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-300 transition hover:text-blue-400"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Split your own bill with Kira-Kira
          </Link>
        </footer>

        {qrExpanded && bill.qrPayload && hasBalance && (
          <Modal onClose={() => setQrExpanded(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm"
            onClick={() => setQrExpanded(false)}
            aria-label="DuitNow QR code"
          >
            <div
              className="glass-card max-h-[calc(100dvh-3rem)] w-full max-w-xs overflow-y-auto p-6 text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-fit rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <QRCodeSVG value={bill.qrPayload} size={240} className="h-auto w-full max-w-[240px]" />
              </div>
              {settlementAmount && <p className="mt-4 text-center text-2xl font-bold tabular-nums text-white">{settlementAmount}</p>}
              <p className="mt-2 text-center text-sm leading-relaxed text-slate-300">{paymentInstruction}</p>
              {amountInMyr && <div className="mt-3 flex"><CopyButton flashKey="qr-amount" label={`Copy ${settlementAmount}`} value={amountInMyr} flash={flash} onCopy={copyValue} /></div>}
              <button
                type="button"
                onClick={() => setQrExpanded(false)}
                className="mt-4 min-h-11 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </Modal>
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
      className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
        active
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
          : 'border-blue-400/30 bg-blue-500/15 text-blue-100 hover:bg-blue-500/25'
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
          <Copy className="w-4 h-4 text-slate-300" />
          {label}
        </>
      )}
    </button>
  );
}
