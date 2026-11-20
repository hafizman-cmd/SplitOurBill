import type { PaymentMark } from '../types';
import type { CurrencyCode } from './currency';

export function paymentMark(amount: number, currency: CurrencyCode, rate: number): PaymentMark {
  const equivalent = amount * rate;
  const myrAmount = currency !== 'MYR' && rate > 0 && Number.isFinite(equivalent)
    ? Number(equivalent.toFixed(2))
    : undefined;
  return { amount, currency, myrAmount };
}

export function paymentStatus(mark: PaymentMark | boolean | undefined, current: PaymentMark) {
  if (!mark) return 'unpaid';
  return mark !== true && mark.amount === current.amount && mark.currency === current.currency &&
    mark.myrAmount === current.myrAmount ? 'paid' : 'review';
}
