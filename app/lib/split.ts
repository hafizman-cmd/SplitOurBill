import type { Item, PersonBreakdown, SplitResult } from '../types';
import { round2 } from './utils';
import { formatMoney, type CurrencyCode } from './currency';

export function computeSplit(
  items: Item[],
  people: string[],
  serviceChargePercent: number,
  taxPercent: number,
  roundingAdjustment = 0,
): SplitResult {
  const serviceCharge = Math.max(0, serviceChargePercent) || 0;
  const tax = Math.max(0, taxPercent) || 0;
  const rounding = Number.isFinite(roundingAdjustment) ? round2(roundingAdjustment) : 0;

  const subtotal = round2(items.reduce((sum, it) => sum + it.price, 0));
  const serviceAmt = round2((subtotal * serviceCharge) / 100);
  const taxAmt = round2((subtotal * tax) / 100);
  const grandTotal = round2(subtotal + serviceAmt + taxAmt + rounding);
  const multiplier = subtotal > 0 ? grandTotal / subtotal : 0;

  const perPerson: Record<string, PersonBreakdown> = {};
  for (const p of people) {
    perPerson[p] = { items: [], raw: 0, final: 0 };
  }
  for (const it of items) {
    const n = it.assigned.length;
    if (n === 0) continue;
    const share = it.price / n;
    for (const p of it.assigned) {
      if (!(p in perPerson)) continue;
      perPerson[p].items.push({
        name: it.name,
        share,
        coSharers: it.assigned.filter((x) => x !== p),
      });
      perPerson[p].raw += share;
    }
  }

  const allocations = people.map((p) => {
    const exact = perPerson[p].raw * multiplier;
    const cents = Math.floor(exact * 100 + 1e-6);
    return { person: p, cents, frac: exact * 100 - cents };
  });

  const totalCents = Math.round(grandTotal * 100);
  let remaining =
    totalCents - allocations.reduce((sum, a) => sum + a.cents, 0);

  const byFracDesc = [...allocations].sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (remaining > 0 && byFracDesc.length > 0) {
    byFracDesc[i % byFracDesc.length].cents += 1;
    remaining -= 1;
    i += 1;
  }
  const byFracAsc = [...allocations].sort((a, b) => a.frac - b.frac);
  i = 0;
  while (remaining < 0 && byFracAsc.length > 0) {
    byFracAsc[i % byFracAsc.length].cents -= 1;
    remaining += 1;
    i += 1;
  }

  for (const a of allocations) {
    perPerson[a.person].final = a.cents / 100;
  }

  return {
    subtotal,
    serviceCharge,
    serviceAmt,
    tax,
    taxAmt,
    roundingAdjustment: rounding,
    grandTotal,
    multiplier,
    perPerson,
  };
}

const DIVIDER = '----------------------------------------';

const ACCOUNT_NUMBER_RE = /^\d[\d\s-]{5,}$/;

function isAccountNumberLine(line: string): boolean {
  const t = line.trim();
  if (t.startsWith('`') && t.endsWith('`')) return false;
  return ACCOUNT_NUMBER_RE.test(t);
}

export function findAccountNumber(bankDetails: string): string | null {
  for (const line of bankDetails.split('\n')) {
    if (isAccountNumberLine(line)) return line.trim();
  }
  return null;
}

export function buildShareText(
  calc: SplitResult,
  people: string[],
  bankDetails: string,
  currency: CurrencyCode = 'MYR',
  myrRate = 1,
  shareUrl = '',
): string {
  const amt = (n: number) => {
    const base = formatMoney(n, currency);
    if (currency === 'MYR' || !Number.isFinite(myrRate) || myrRate <= 0) {
      return base;
    }
    return `${base} (≈ RM ${(n * myrRate).toFixed(2)})`;
  };
  const lines: string[] = [];
  lines.push('Kira-Kira - Bill Split Summary');
  lines.push('');
  lines.push(DIVIDER);
  lines.push('TOTAL AMOUNT DUE');
  lines.push(DIVIDER);
  lines.push(`Subtotal: ${amt(calc.subtotal)}`);
  lines.push(`Service Charge (${calc.serviceCharge}%): ${amt(calc.serviceAmt)}`);
  lines.push(`Tax (${calc.tax}%): ${amt(calc.taxAmt)}`);
  if (calc.roundingAdjustment !== 0) {
    lines.push(`Rounding Adjustment: ${amt(calc.roundingAdjustment)}`);
  }
  lines.push(`Grand Total: ${amt(calc.grandTotal)}`);
  lines.push('');

  lines.push(DIVIDER);
  lines.push('ITEM BREAKDOWN');
  lines.push(DIVIDER);
  for (const p of people) {
    const entry = calc.perPerson[p];
    lines.push(`${p} pays ${amt(entry.final)}`);
    for (const it of entry.items) {
      const shared =
        it.coSharers.length > 0
          ? ` (shared with ${it.coSharers.join(', ')})`
          : '';
      lines.push(`  • ${it.name}: ${amt(it.share)}${shared}`);
    }
    if (entry.items.length === 0) lines.push('  • No items assigned');
  }

  if (bankDetails.trim()) {
    lines.push('');
    lines.push(DIVIDER);
    lines.push('PAYMENT DETAILS');
    lines.push(DIVIDER);
    for (const line of bankDetails.split('\n')) {
      lines.push(
        isAccountNumberLine(line) ? `\`${line.trim()}\`` : line.trim(),
      );
    }
  }

  if (shareUrl) {
    lines.push('');
    lines.push(`View breakdown: ${shareUrl}`);
  }

  lines.push('');
  lines.push(DIVIDER);
  lines.push('Split fairly with Kira-Kira.');
  return lines.join('\n');
}
