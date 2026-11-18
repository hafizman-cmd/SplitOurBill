import type { HistoryEntry, Item, ReceiptSnapshot } from '../types';
import { CURRENCIES, type CurrencyCode } from './currency';

export type BillDraft = {
  version: 1;
  historyId: string | null;
  restaurantName: string;
  billDate: string;
  items: Item[];
  people: string[];
  paidStatus: Record<string, boolean>;
  serviceChargeInput: string;
  taxInput: string;
  roundingAdjustmentInput: string;
  currency: CurrencyCode;
  rateInput: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const currencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && Object.hasOwn(CURRENCIES, value);
const items = (value: unknown): value is Item[] =>
  Array.isArray(value) && value.every((item: unknown) => record(item) &&
    typeof item.id === 'string' && typeof item.name === 'string' &&
    finite(item.price) && item.price >= 0 && strings(item.assigned));
const paidStatus = (value: unknown): value is Record<string, boolean> =>
  record(value) && Object.values(value).every((paid) => typeof paid === 'boolean');

export function parseBillDraft(raw: string): BillDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 ||
      !(value.historyId === null || typeof value.historyId === 'string') ||
      typeof value.restaurantName !== 'string' || typeof value.billDate !== 'string' ||
      !items(value.items) || !strings(value.people) || !paidStatus(value.paidStatus) ||
      !currencyCode(value.currency) ||
      !['serviceChargeInput', 'taxInput', 'roundingAdjustmentInput', 'rateInput'].every((key) => typeof value[key] === 'string')) return null;
    return value as BillDraft;
  } catch {
    return null;
  }
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!record(value) || typeof value.id !== 'string' || typeof value.date !== 'string' ||
    typeof value.restaurantName !== 'string' || !finite(value.grandTotal) ||
    !finite(value.itemsCount) || !record(value.receiptData)) return false;
  const snapshot = value.receiptData;
  return items(snapshot.items) && strings(snapshot.people) &&
    (snapshot.paidStatus === undefined || paidStatus(snapshot.paidStatus)) &&
    finite(snapshot.serviceCharge) && finite(snapshot.tax) &&
    (snapshot.roundingAdjustment === undefined || finite(snapshot.roundingAdjustment)) &&
    (snapshot.currency === undefined || currencyCode(snapshot.currency)) &&
    (snapshot.myrRate === undefined || finite(snapshot.myrRate));
}

export function snapshotFromDraft(draft: BillDraft): ReceiptSnapshot {
  return {
    items: draft.items,
    people: draft.people,
    paidStatus: draft.paidStatus,
    serviceCharge: Math.max(0, Number(draft.serviceChargeInput) || 0),
    tax: Math.max(0, Number(draft.taxInput) || 0),
    roundingAdjustment: Number(draft.roundingAdjustmentInput) || 0,
    currency: draft.currency,
    myrRate: draft.currency === 'MYR' ? 1 : Math.max(0, Number(draft.rateInput) || 0),
  };
}
