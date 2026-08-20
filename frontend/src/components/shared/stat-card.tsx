import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Delta, Money } from './money';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/format';

export function StatCard({
  label,
  value,
  currency,
  change,
  icon: Icon,
  tone = 'default',
  hint,
  format = 'money',
  className,
}: {
  label: string;
  value: number;
  currency?: string;
  change?: number | null;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
  hint?: string;
  format?: 'money' | 'number';
  className?: string;
}) {
  const tones = {
    default: 'text-muted-foreground bg-muted',
    primary: 'text-primary bg-primary-muted',
    success: 'text-success bg-success-muted',
    warning: 'text-warning bg-warning-muted',
    danger: 'text-danger bg-danger-muted',
  };

  return (
    <Card className={cn('p-5 transition-shadow hover:shadow-raised', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tones[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>

      <p className="mt-2.5 text-2xl font-semibold tracking-tight">
        {format === 'money' ? (
          <Money value={value} currency={currency} compact />
        ) : (
          <span className="tabular">{formatNumber(value)}</span>
        )}
      </p>

      <div className="mt-1.5">
        {change !== undefined ? (
          <Delta value={change} />
        ) : hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </Card>
  );
}
