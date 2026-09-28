export type CurrencyCode = 'MYR' | 'SGD' | 'THB' | 'IDR';

export const CURRENCIES: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; name: string; defaultRate: number }
> = {
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', defaultRate: 1 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', defaultRate: 3.3 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', defaultRate: 0.13 },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', defaultRate: 0.00027 },
};

export const CURRENCY_OPTIONS: CurrencyCode[] = ['MYR', 'SGD', 'THB', 'IDR'];

export function formatMoney(amount: number, code: CurrencyCode): string {
  if (code === 'IDR') {
    return `Rp ${Math.round(amount).toLocaleString('en-US')}`;
  }
  return `${CURRENCIES[code].symbol} ${amount.toFixed(2)}`;
}

export function formatMyrEquivalent(
  amount: number,
  code: CurrencyCode,
  rate: number,
): string | null {
  if (code === 'MYR' || !Number.isFinite(rate) || rate <= 0) return null;
  return `≈ RM ${(amount * rate).toFixed(2)}`;
}
