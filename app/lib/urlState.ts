import LZString from 'lz-string';
import { CURRENCIES, type CurrencyCode } from './currency';

export type SharedItem = {
  name: string;
  share: number;
};

export type SharedPerson = {
  items: SharedItem[];
  raw: number;
  final: number;
};

export type SharedBill = {
  restaurantName: string;
  date: string;
  currency: CurrencyCode;
  myrRate: number;
  people: string[];
  perPerson: Record<string, SharedPerson>;
  subtotal: number;
  serviceCharge: number;
  serviceAmt: number;
  tax: number;
  taxAmt: number;
  roundingAdjustment: number;
  grandTotal: number;
  bankDetails: string;
  qrPayload: string;
};

export function encodeBillToUrl(bill: SharedBill): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(bill));
}

export function decodeBillFromUrl(
  compressed: string | null | undefined,
): SharedBill | null {
  if (!compressed) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return coerceSharedBill(JSON.parse(json));
  } catch {
    return null;
  }
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegative(value: unknown): number {
  return isNumber(value) ? Math.max(0, value) : 0;
}

function signed(value: unknown): number {
  return isNumber(value) ? Math.round(value * 100) / 100 : 0;
}

function coerceSharedBill(data: unknown): SharedBill | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;

  const people = Array.isArray(d.people)
    ? Array.from(
        new Set(
          d.people.filter(
            (p): p is string => typeof p === 'string' && p.trim() !== '',
          ),
        ),
      )
    : [];
  if (people.length === 0) return null;

  const perPersonRaw =
    typeof d.perPerson === 'object' && d.perPerson !== null
      ? (d.perPerson as Record<string, unknown>)
      : {};
  const perPerson: Record<string, SharedPerson> = {};
  for (const person of people) {
    const entry = perPersonRaw[person];
    if (typeof entry !== 'object' || entry === null) {
      perPerson[person] = { items: [], raw: 0, final: 0 };
      continue;
    }
    const e = entry as Record<string, unknown>;
    const items = Array.isArray(e.items)
      ? e.items
          .filter(
            (it): it is Record<string, unknown> =>
              typeof it === 'object' && it !== null,
          )
          .filter(
            (it) =>
              typeof it.name === 'string' && it.name.trim() !== '' && isNumber(it.share),
          )
          .map((it) => ({
            name: it.name as string,
            share: Math.max(0, it.share as number),
          }))
      : [];
    perPerson[person] = {
      items,
      raw: nonNegative(e.raw),
      final: nonNegative(e.final),
    };
  }

  const currency: CurrencyCode =
    typeof d.currency === 'string' && d.currency in CURRENCIES
      ? (d.currency as CurrencyCode)
      : 'MYR';

  return {
    restaurantName:
      typeof d.restaurantName === 'string' && d.restaurantName.trim() !== ''
        ? d.restaurantName
        : 'Kira-Kira Bill',
    date: typeof d.date === 'string' ? d.date : '',
    currency,
    myrRate: isNumber(d.myrRate) && d.myrRate > 0 ? d.myrRate : 1,
    people,
    perPerson,
    subtotal: nonNegative(d.subtotal),
    serviceCharge: nonNegative(d.serviceCharge),
    serviceAmt: nonNegative(d.serviceAmt),
    tax: nonNegative(d.tax),
    taxAmt: nonNegative(d.taxAmt),
    roundingAdjustment: signed(d.roundingAdjustment),
    grandTotal: nonNegative(d.grandTotal),
    bankDetails: typeof d.bankDetails === 'string' ? d.bankDetails : '',
    qrPayload:
      typeof d.qrPayload === 'string' &&
      d.qrPayload.startsWith('0002') &&
      d.qrPayload.length <= 2048
        ? d.qrPayload
        : '',
  };
}
