import { Prisma } from '@prisma/client';

import Decimal = Prisma.Decimal;

export type Numeric = Decimal | number | string | null | undefined;

/** Coerce anything numeric-ish coming from Prisma/JSON into a Decimal. */
export const toDecimal = (value: Numeric): Decimal => {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
};

export const D = toDecimal;

/**
 * Currency rounding to 2 dp using half-up, which is what invoices and
 * statutory statements expect (JS `toFixed` uses banker's-ish float rounding
 * and drifts on values like 1.005).
 */
export const round2 = (value: Numeric): Decimal =>
  toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const add = (...values: Numeric[]): Decimal =>
  values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v)), new Decimal(0));

export const subtract = (a: Numeric, b: Numeric): Decimal => toDecimal(a).minus(toDecimal(b));

export const multiply = (a: Numeric, b: Numeric): Decimal => toDecimal(a).times(toDecimal(b));

export const divide = (a: Numeric, b: Numeric): Decimal => {
  const divisor = toDecimal(b);
  if (divisor.isZero()) return new Decimal(0);
  return toDecimal(a).dividedBy(divisor);
};

export const percentOf = (value: Numeric, percent: Numeric): Decimal =>
  round2(multiply(value, divide(percent, 100)));

export const isZero = (value: Numeric): boolean => toDecimal(value).isZero();
export const isPositive = (value: Numeric): boolean => toDecimal(value).greaterThan(0);
export const isNegative = (value: Numeric): boolean => toDecimal(value).lessThan(0);
export const gte = (a: Numeric, b: Numeric): boolean => toDecimal(a).greaterThanOrEqualTo(toDecimal(b));
export const lte = (a: Numeric, b: Numeric): boolean => toDecimal(a).lessThanOrEqualTo(toDecimal(b));

/** Decimal -> number, only at the API boundary where JSON needs a number. */
export const toNumber = (value: Numeric): number => toDecimal(value).toNumber();

/** Decimal -> fixed-2 string, for PDF/HTML rendering where precision matters. */
export const toFixed2 = (value: Numeric): string => round2(value).toFixed(2);

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
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
};

export const formatCurrency = (value: Numeric, currency = 'INR'): string => {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
};

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;

const threeDigits = (n: number): string => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return [
    hundred ? `${ONES[hundred]} Hundred` : '',
    rest ? twoDigits(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
};

/**
 * "Amount in words" line required on Indian tax invoices.
 * Uses the lakh/crore grouping for INR and the international scale otherwise.
 */
export const amountToWords = (value: Numeric, currency = 'INR'): string => {
  const amount = round2(value);
  const whole = amount.floor().toNumber();
  const fraction = amount.minus(amount.floor()).times(100).round().toNumber();

  const subunit = currency === 'INR' ? 'Paise' : 'Cents';
  const unit =
    currency === 'INR' ? 'Rupees' : currency === 'USD' ? 'Dollars' : currency;

  if (whole === 0 && fraction === 0) return `Zero ${unit} Only`;

  const parts: string[] = [];

  if (currency === 'INR') {
    const crore = Math.floor(whole / 10000000);
    const lakh = Math.floor((whole % 10000000) / 100000);
    const thousand = Math.floor((whole % 100000) / 1000);
    const rest = whole % 1000;
    if (crore) parts.push(`${threeDigits(crore)} Crore`);
    if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (rest) parts.push(threeDigits(rest));
  } else {
    const billion = Math.floor(whole / 1000000000);
    const million = Math.floor((whole % 1000000000) / 1000000);
    const thousand = Math.floor((whole % 1000000) / 1000);
    const rest = whole % 1000;
    if (billion) parts.push(`${threeDigits(billion)} Billion`);
    if (million) parts.push(`${threeDigits(million)} Million`);
    if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
    if (rest) parts.push(threeDigits(rest));
  }

  const wholeWords = parts.join(' ').trim() || 'Zero';
  const fractionWords = fraction ? ` and ${twoDigits(fraction)} ${subunit}` : '';
  return `${wholeWords} ${unit}${fractionWords} Only`;
};
