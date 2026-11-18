import type { CurrencyCode, ExchangeRateSource } from './lib/currency';

export type Item = {
  id: string;
  name: string;
  price: number;
  assigned: string[];
};

export type ReceiptCharges = {
  discount?: number;
  serviceAmount?: number;
  taxAmount?: number;
  reviewedSubtotal?: number;
};

export type ScanResponse = {
  receiptCharges?: ReceiptCharges;
  printedTotal?: number;
  reviewNotes?: string[];
  items: { name: string; price: number }[];
  serviceChargePercent: number;
  taxPercent: number;
  roundingAdjustment: number;
  restaurantName?: string;
  remaining?: number;
  resetsAt?: number;
  developer?: boolean;
};

export type ReceiptSnapshot = {
  receiptCharges?: ReceiptCharges;
  items: Item[];
  people: string[];
  paidStatus: Record<string, boolean>;
  serviceCharge: number;
  tax: number;
  roundingAdjustment?: number;
  currency?: CurrencyCode;
  myrRate?: number;
  rateSource?: ExchangeRateSource;
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
  issue?: 'invalidAmounts' | 'zeroSubtotal';
  discount: number;
  subtotal: number;
  serviceCharge: number;
  serviceAmt: number;
  tax: number;
  taxAmt: number;
  roundingAdjustment: number;
  grandTotal: number;
  multiplier: number;
  perPerson: Record<string, PersonBreakdown>;
};
