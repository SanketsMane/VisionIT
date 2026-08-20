const CURRENCY_LOCALE: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  AUD: 'en-AU',
  CAD: 'en-CA',
  SGD: 'en-SG',
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', AUD: 'A$', CAD: 'C$', SGD: 'S$',
};

export const formatMoney = (value: number | string | null | undefined, currency = 'INR'): string => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
};

/**
 * Compact money for dashboard tiles. INR uses the lakh/crore scale because
 * "₹12.5L" reads instantly to an Indian user where "₹1.25M" does not.
 */
export const formatMoneyCompact = (value: number | null | undefined, currency = 'INR'): string => {
  const amount = Number(value ?? 0);
  const symbol = CURRENCY_SYMBOL[currency] ?? '';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (currency === 'INR') {
    if (abs >= 1e7) return `${sign}${symbol}${(abs / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${sign}${symbol}${(abs / 1e5).toFixed(2)}L`;
    if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}K`;
    return `${sign}${symbol}${abs.toFixed(0)}`;
  }

  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
};

export const formatNumber = (value: number | null | undefined, locale = 'en-IN'): string =>
  new Intl.NumberFormat(locale).format(Number(value ?? 0));

export const formatPercent = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? '—' : `${Number(value).toFixed(digits)}%`;

export const formatDate = (
  value: string | Date | null | undefined,
  style: 'short' | 'medium' | 'long' | 'month' = 'medium',
): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: 'short' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    month: { month: 'long', year: 'numeric' },
  };

  // UTC throughout: the API stores date-only values at midnight UTC, and
  // rendering those in a negative-offset local zone would show the day before.
  return new Intl.DateTimeFormat('en-IN', { ...options[style], timeZone: 'UTC' }).format(date);
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
};

export const formatRelative = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ];

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return rtf.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return rtf.format(seconds, 'second');
};

/** ENUM_VALUE -> "Enum value" for display without a lookup table per enum. */
export const humanize = (value?: string | null): string => {
  if (!value) return '—';
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};
