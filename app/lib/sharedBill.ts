import { CURRENCIES, type CurrencyCode } from './currency';

type SharedItem = { name: string; share: number };
type SharedPerson = { items: SharedItem[]; final: number };

export type SharedBill = {
  restaurantName: string;
  date: string;
  currency: CurrencyCode;
  myrRate: number;
  people: string[];
  perPerson: Record<string, SharedPerson>;
  subtotal: number;
  discount?: number;
  serviceCharge: number;
  serviceAmt: number;
  tax: number;
  taxAmt: number;
  roundingAdjustment: number;
  grandTotal: number;
  bankDetails: string;
  qrPayload: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseSharedBill(value: unknown): SharedBill | null {
  const bill = record(value);
  if (!bill) return null;
  const {
    restaurantName, date, currency, myrRate, people, subtotal, discount, serviceCharge,
    serviceAmt, tax, taxAmt, roundingAdjustment, grandTotal, bankDetails, qrPayload,
  } = bill;
  const entries = record(bill.perPerson);
  if (
    typeof restaurantName !== 'string' || !restaurantName.trim() ||
    typeof date !== 'string' || !Number.isFinite(Date.parse(date)) ||
    typeof currency !== 'string' || !Object.hasOwn(CURRENCIES, currency) ||
    !finite(myrRate) || myrRate < 0 ||
    !Array.isArray(people) || people.length === 0 || new Set(people).size !== people.length ||
    !entries ||
    !finite(subtotal) || (discount !== undefined && (!finite(discount) || discount < 0)) || !finite(serviceCharge) || !finite(serviceAmt) ||
    !finite(tax) || !finite(taxAmt) || !finite(roundingAdjustment) || !finite(grandTotal) ||
    typeof bankDetails !== 'string' || typeof qrPayload !== 'string' ||
    (qrPayload !== '' && (!qrPayload.startsWith('0002') || qrPayload.length > 2048))
  ) return null;

  const names: string[] = [];
  const perPerson: [string, SharedPerson][] = [];
  for (const person of people) {
    if (typeof person !== 'string' || !person.trim() || !Object.hasOwn(entries, person)) return null;
    const entry = record(entries[person]);
    if (!entry || !Array.isArray(entry.items) || !finite(entry.final)) return null;

    const items: SharedItem[] = [];
    for (const item of entry.items) {
      const detail = record(item);
      if (!detail || typeof detail.name !== 'string' || !detail.name.trim() || !finite(detail.share)) return null;
      items.push({ name: detail.name, share: detail.share });
    }
    names.push(person);
    perPerson.push([person, { items, final: entry.final }]);
  }

  return {
    restaurantName, date, currency: currency as CurrencyCode, myrRate,
    people: names, perPerson: Object.fromEntries(perPerson), subtotal, discount, serviceCharge,
    serviceAmt, tax, taxAmt, roundingAdjustment, grandTotal, bankDetails, qrPayload,
  };
}
