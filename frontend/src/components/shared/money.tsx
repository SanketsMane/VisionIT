import { cn } from '@/lib/utils';
import { formatMoney, formatMoneyCompact } from '@/lib/format';

/**
 * Renders an amount with tabular figures so columns align, and optionally
 * signs it green/red. `compact` is for tiles; full precision for tables.
 */
export function Money({
  value,
  currency = 'INR',
  compact = false,
  colored = false,
  className,
}: {
  value: number | string | null | undefined;
  currency?: string;
  compact?: boolean;
  colored?: boolean;
  className?: string;
}) {
  const amount = Number(value ?? 0);
  const text = compact ? formatMoneyCompact(amount, currency) : formatMoney(amount, currency);

  return (
    <span
      className={cn(
        'tabular',
        colored && amount > 0 && 'text-success',
        colored && amount < 0 && 'text-danger',
        className,
      )}
      title={compact ? formatMoney(amount, currency) : undefined}
    >
      {text}
    </span>
  );
}

/** Percentage delta with an arrow — null renders a neutral dash. */
export function Delta({
  value,
  className,
  suffix = 'vs last month',
}: {
  value: number | null | undefined;
  className?: string;
  suffix?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={cn('text-xs text-muted-foreground', className)}>No prior data</span>;
  }

  const isUp = value > 0;
  const isFlat = Math.abs(value) < 0.05;
  const magnitude = Math.abs(value);

  /*
   * Growing from near-zero produces figures like "4975%", which reads as a bug
   * rather than as information. Past 999% the exact number tells the user
   * nothing they don't already get from the arrow, so it is capped.
   */
  const display = magnitude >= 1000 ? '>999' : magnitude.toFixed(1);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium tabular',
        isFlat ? 'text-muted-foreground' : isUp ? 'text-success' : 'text-danger',
        className,
      )}
      title={magnitude >= 1000 ? `${value.toFixed(1)}%` : undefined}
    >
      {!isFlat && (isUp ? '▲' : '▼')}
      {display}%
      <span className="font-normal text-muted-foreground">{suffix}</span>
    </span>
  );
}
