export const ANALYTICS_RANGES = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  all: 'All time',
} as const;

export type AnalyticsRange = keyof typeof ANALYTICS_RANGES;

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = '7d';
export const ADMIN_EVENT_PAGE_SIZE = 10;

export type AdminEvent = {
  id: string;
  eventName: string;
  osName: string;
  deviceBrand: string;
  createdAt: string;
};

export type Distribution = { label: string; count: number };
export type ScanBucket = { label: string; successful: number; failed: number };

export type AnalyticsData = {
  updatedAt: string;
  appOpens: number;
  mobileOpens: number;
  successfulScans: number;
  failedScans: number;
  clientErrors: number;
  serverSuccesses: number;
  serverOutcomes: number;
  serverSuccessRate: number | null;
  scanTrend: ScanBucket[];
  osDistribution: Distribution[];
  brandDistribution: Distribution[];
  recentEvents: AdminEvent[];
};

export function osLabel(osName: string): string {
  if (/ios|ipados/i.test(osName)) return 'iOS';
  if (/android/i.test(osName)) return 'Android';
  if (/mac/i.test(osName)) return 'macOS';
  if (/windows/i.test(osName)) return 'Windows';
  if (/chrome\s?os|chromium\s?os/i.test(osName)) return 'ChromeOS';
  if (/linux/i.test(osName)) return 'Linux';
  return 'Other';
}

const ANDROID_BRANDS = [
  'Samsung', 'Pixel', 'Google', 'Xiaomi', 'Redmi', 'Huawei', 'Honor', 'Oppo',
  'Vivo', 'OnePlus', 'Motorola', 'Sony', 'Nokia', 'Realme', 'Nothing', 'Asus', 'Lenovo',
];

export function brandLabel(os: string, brand: string): string {
  if (os === 'iOS' || os === 'macOS') return 'Apple';
  if (os !== 'Android') return 'Unknown';
  const recognisedBrand = ANDROID_BRANDS.find((name) => name.toLowerCase() === brand.trim().toLowerCase());
  return recognisedBrand === 'Pixel' ? 'Google' : recognisedBrand ?? 'Unknown';
}

export function deviceLabel(osName: string, brand: string): string {
  const os = osLabel(osName);
  if (os === 'Other') return 'Unknown device';
  if (os === 'iOS' && /^ipad$/i.test(brand.trim())) return 'iPad';
  const vendor = brandLabel(os, brand);
  return os === 'Android' && vendor !== 'Unknown' ? `${os} · ${vendor}` : os;
}
