export type CurrencyCode = 'MYR' | 'SGD' | 'THB' | 'IDR';
export type ExchangeRateSource =
  | { kind: 'estimate' | 'manual' }
  | { kind: 'frankfurter'; date: string };

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

export const currencyDecimalPlaces = (code: CurrencyCode) => code === 'IDR' ? 0 : 2;

export function parseMyrRate(value: string): number {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

function isRateDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isExchangeRateSource(value: unknown): value is ExchangeRateSource {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false;
  return value.kind === 'estimate' || value.kind === 'manual' ||
    (value.kind === 'frankfurter' && 'date' in value && isRateDate(value.date));
}

export function parseReferenceRate(value: unknown, currency: Exclude<CurrencyCode, 'MYR'>) {
  if (!value || typeof value !== 'object') return null;
  const { base, quote, date, rate } = value as Record<string, unknown>;
  if (base !== currency || quote !== 'MYR' || !isRateDate(date) ||
    typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
  return { rate, date };
}

export function formatMoney(amount: number, code: CurrencyCode): string {
  if (code === 'IDR') {
    return `Rp ${Math.round(amount).toLocaleString('en-US')}`;
  }
  return `${CURRENCIES[code].symbol} ${amount.toFixed(currencyDecimalPlaces(code))}`;
}

export function formatMyrEquivalent(
  amount: number,
  code: CurrencyCode,
  rate: number,
): string | null {
  if (code === 'MYR' || !Number.isFinite(rate) || rate <= 0) return null;
  const equivalent = amount * rate;
  return Number.isFinite(equivalent) ? `≈ RM ${equivalent.toFixed(2)}` : null;
}
