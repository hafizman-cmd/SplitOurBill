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
