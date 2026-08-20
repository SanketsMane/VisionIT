import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);

export { dayjs };

export interface DateRange {
  start: Date;
  end: Date;
}

/** Inclusive month window in UTC: [1st 00:00:00.000, last 23:59:59.999]. */
export const monthRange = (year: number, month: number): DateRange => ({
  start: dayjs.utc(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate(),
  end: dayjs.utc(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month').toDate(),
});

/**
 * Fiscal year window. India's default start month is April (4), so FY2025
 * spans 2025-04-01 → 2026-03-31. Pass `startMonth = 1` for calendar years.
 */
export const fiscalYearRange = (year: number, startMonth = 4): DateRange => {
  const start = dayjs.utc(`${year}-${String(startMonth).padStart(2, '0')}-01`).startOf('month');
  return { start: start.toDate(), end: start.add(1, 'year').subtract(1, 'millisecond').toDate() };
};

export const quarterRange = (year: number, quarter: 1 | 2 | 3 | 4, startMonth = 4): DateRange => {
  const fyStart = dayjs.utc(`${year}-${String(startMonth).padStart(2, '0')}-01`).startOf('month');
  const start = fyStart.add((quarter - 1) * 3, 'month');
  return { start: start.toDate(), end: start.add(3, 'month').subtract(1, 'millisecond').toDate() };
};

export const dayRange = (date: Date | string): DateRange => ({
  start: dayjs.utc(date).startOf('day').toDate(),
  end: dayjs.utc(date).endOf('day').toDate(),
});

/** Which fiscal year a date belongs to, given a fiscal start month. */
export const fiscalYearOf = (date: Date | string, startMonth = 4): number => {
  const d = dayjs.utc(date);
  return d.month() + 1 >= startMonth ? d.year() : d.year() - 1;
};

/** Ordered month buckets between two dates — the x-axis of every trend chart. */
export const monthsBetween = (start: Date, end: Date): { year: number; month: number; label: string }[] => {
  const buckets: { year: number; month: number; label: string }[] = [];
  let cursor = dayjs.utc(start).startOf('month');
  const last = dayjs.utc(end).startOf('month');
  while (cursor.isSameOrBefore(last)) {
    buckets.push({ year: cursor.year(), month: cursor.month() + 1, label: cursor.format('MMM YYYY') });
    cursor = cursor.add(1, 'month');
  }
  return buckets;
};

export const addDays = (date: Date | string, days: number): Date =>
  dayjs.utc(date).add(days, 'day').toDate();

export const daysBetween = (from: Date | string, to: Date | string): number =>
  dayjs.utc(to).startOf('day').diff(dayjs.utc(from).startOf('day'), 'day');

export const isOverdue = (dueDate: Date | string): boolean =>
  dayjs.utc().startOf('day').isAfter(dayjs.utc(dueDate).startOf('day'));

export const formatDate = (date: Date | string | null | undefined, pattern = 'DD MMM YYYY'): string =>
  date ? dayjs.utc(date).format(pattern) : '—';

export const startOfToday = (): Date => dayjs.utc().startOf('day').toDate();
