import type { CurrencyCode } from './lib/currency';

export type Item = {
  id: string;
  name: string;
  price: number;
  assigned: string[];
};

export type ScanResponse = {
  items: { name: string; price: number }[];
  serviceChargePercent: number;
  taxPercent: number;
  restaurantName?: string;
};

export type ReceiptSnapshot = {
  items: Item[];
  people: string[];
  paidStatus: Record<string, boolean>;
  serviceCharge: number;
  tax: number;
  currency?: CurrencyCode;
  myrRate?: number;
};

export type HistoryEntry = {
  id: string;
  date: string;
  restaurantName: string;
  grandTotal: number;
  itemsCount: number;
  receiptData: ReceiptSnapshot;
};

export type PersonBreakdown = {
  items: { name: string; share: number; coSharers: string[] }[];
  raw: number;
  final: number;
};

export type SplitResult = {
  subtotal: number;
  serviceCharge: number;
  serviceAmt: number;
  tax: number;
  taxAmt: number;
  grandTotal: number;
  multiplier: number;
  perPerson: Record<string, PersonBreakdown>;
};
