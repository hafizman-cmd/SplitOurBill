import type { Item, PersonBreakdown, ReceiptCharges, SplitResult } from '../types';
import { round2 } from './utils';
import { currencyDecimalPlaces, formatMoney, formatMyrEquivalent, type CurrencyCode } from './currency';

export const MAX_BILL_AMOUNT = 1_000_000_000;
export const MAX_CHARGE_PERCENT = 100;

export function isBillAmount(amount: number, signed = false): boolean {
  return Number.isFinite(amount) && amount >= (signed ? -MAX_BILL_AMOUNT : 0) && amount <= MAX_BILL_AMOUNT;
}

const isChargePercent = (percent: number) =>
  Number.isFinite(percent) && percent >= 0 && percent <= MAX_CHARGE_PERCENT;

export function computeSplit(
  items: Item[],
  people: string[],
  serviceChargePercent: number,
  taxPercent: number,
  roundingAdjustment = 0,
  receiptCharges?: ReceiptCharges,
  currency: CurrencyCode = 'MYR',
): SplitResult {
  const perPerson: Record<string, PersonBreakdown> = Object.fromEntries(
    people.map((person) => [person, { items: [], raw: 0, final: 0 }]),
  );
  const invalidResult: SplitResult = {
    issue: 'invalidAmounts', subtotal: 0, discount: 0, serviceCharge: 0, serviceAmt: 0,
    tax: 0, taxAmt: 0, roundingAdjustment: 0, grandTotal: 0, multiplier: 0, perPerson,
  };

  if (!items.every((item) => isBillAmount(item.price))) return invalidResult;
  const subtotal = round2(items.reduce((sum, it) => sum + it.price, 0));
  if (!isBillAmount(subtotal)) return invalidResult;
  invalidResult.subtotal = subtotal;

  if (!isChargePercent(serviceChargePercent) || !isChargePercent(taxPercent) ||
    !isBillAmount(roundingAdjustment, true) ||
    ![receiptCharges?.discount, receiptCharges?.serviceAmount, receiptCharges?.taxAmount]
      .every((amount) => amount === undefined || isBillAmount(amount))) return invalidResult;

  const discount = Math.min(subtotal, round2(receiptCharges?.discount ?? 0));
  const discountedSubtotal = round2(subtotal - discount);
  const serviceAmt = round2(receiptCharges?.serviceAmount ?? (discountedSubtotal * serviceChargePercent) / 100);
  const taxAmt = round2(receiptCharges?.taxAmount ?? (discountedSubtotal * taxPercent) / 100);
  const rounding = round2(roundingAdjustment);
  const total = Math.max(0, round2(discountedSubtotal + serviceAmt + taxAmt + rounding));
  if (!isBillAmount(total)) return invalidResult;
  const unitScale = 10 ** currencyDecimalPlaces(currency);
  const totalUnits = Math.round(total * unitScale);
  const grandTotal = totalUnits / unitScale;

  const result: SplitResult = {
    subtotal, discount, serviceCharge: serviceChargePercent, serviceAmt, tax: taxPercent, taxAmt,
    roundingAdjustment: rounding, grandTotal, multiplier: subtotal > 0 ? grandTotal / subtotal : 0, perPerson,
  };
  if (subtotal === 0 && totalUnits > 0) result.issue = 'zeroSubtotal';

  let missingAssignment = false;
  for (const it of items) {
    const assigned = [...new Set(it.assigned)].filter((person) => Object.hasOwn(perPerson, person));
    if (assigned.length === 0) {
      missingAssignment = true;
      continue;
    }
    const share = it.price / assigned.length;
    for (const p of assigned) {
      perPerson[p].items.push({
        name: it.name,
        share,
        coSharers: assigned.filter((x) => x !== p),
      });
      perPerson[p].raw += share;
    }
  }
  if (missingAssignment || result.issue || totalUnits === 0) return result;

  const recipients = [...new Set(people)].map((person) => perPerson[person]).filter((entry) => entry.raw > 0);
  if (recipients.length === 0) return result;
  const assignedTotal = recipients.reduce((sum, entry) => sum + entry.raw, 0);
  const allocations = recipients.map((entry) => {
    const exact = (entry.raw / assignedTotal) * totalUnits;
    const units = Math.floor(exact);
    return { entry, units, fraction: exact - units };
  });

  const remaining = totalUnits - allocations.reduce((sum, entry) => sum + entry.units, 0);
  if (remaining > 0) {
    allocations.sort((a, b) => b.fraction - a.fraction);
    const unitsEach = Math.floor(remaining / allocations.length);
    const extras = remaining % allocations.length;
    allocations.forEach((allocation, index) => {
      allocation.units += unitsEach + (index < extras ? 1 : 0);
    });
  } else if (remaining < 0) {
    allocations.sort((a, b) => a.fraction - b.fraction);
    let excess = -remaining;
    for (const allocation of allocations) {
      const reduction = Math.min(excess, allocation.units);
      allocation.units -= reduction;
      excess -= reduction;
      if (excess === 0) break;
    }
  }

  for (const { entry, units } of allocations) entry.final = units / unitScale;
  return result;
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
  format: 'plain' | 'whatsapp' = 'plain',
): string {
  const amt = (n: number) => {
    const base = formatMoney(n, currency);
    const equivalent = formatMyrEquivalent(n, currency, myrRate);
    return equivalent ? `${base} (${equivalent})` : base;
  };
  const lines: string[] = [];
  lines.push('Kira-Kira - Bill Split Summary');
  lines.push('');
  lines.push(DIVIDER);
  lines.push('TOTAL AMOUNT DUE');
  lines.push(DIVIDER);
  lines.push(`Subtotal: ${amt(calc.subtotal)}`);
  if (calc.discount > 0) lines.push(`Discount: -${amt(calc.discount)}`);
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
  for (const [index, p] of people.entries()) {
    if (index > 0) lines.push('');
    const entry = calc.perPerson[p];
    const name = p.replace(/\s+/g, ' ').trim();
    const heading = `${name} pays ${amt(entry.final)}`;
    lines.push(format === 'whatsapp' ? `*${heading}*` : heading);
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
