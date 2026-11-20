import type { Item, SplitResult } from '../types';
import type { CurrencyCode } from './currency';
import { computeSplit } from './split';
import { round2 } from './utils';

export function mergeReceiptTotals(items: Item[], existing: SplitResult, receipt: SplitResult, currency: CurrencyCode) {
  const serviceAmount = round2(existing.serviceAmt + receipt.serviceAmt);
  const taxAmount = round2(existing.taxAmt + receipt.taxAmt);
  const discount = round2(existing.discount + receipt.discount);
  const roundingAdjustment = round2(existing.roundingAdjustment + receipt.roundingAdjustment);
  const receiptCharges = {
    serviceAmount: serviceAmount || undefined,
    taxAmount: taxAmount || undefined,
    discount: discount || undefined,
  };
  const totals = computeSplit(items, [], 0, 0, roundingAdjustment, receiptCharges, currency);
  return {
    totals,
    roundingAdjustment,
    receiptCharges: { ...receiptCharges, reviewedSubtotal: totals.subtotal },
  };
}
