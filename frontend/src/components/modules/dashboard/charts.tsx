'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import type { TrendPoint } from '@/types';

/**
 * Chart colours come from CSS variables so both themes are handled by the
 * same code path — recharts reads the computed value at render time.
 */
export const SERIES = {
  revenue: 'var(--color-chart-1)',
  expenses: 'var(--color-chart-4)',
  profit: 'var(--color-chart-3)',
  collected: 'var(--color-chart-2)',
};

export const CATEGORICAL = [
  'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)',
  'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)',
];

const axisProps = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

/** Shared tooltip so every chart in the app reads identically. */
function ChartTooltip({
  active,
  payload,
  label,
  currency = 'INR',
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  currency?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-float">
      {label && <p className="mb-1.5 text-[11px] font-semibold">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold tabular">{formatMoney(item.value ?? 0, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueTrendChart({
  data,
  currency = 'INR',
  height = 260,
}: {
  data: TrendPoint[];
  currency?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          {(['revenue', 'expenses'] as const).map((key) => (
            <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[key]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES[key]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(value: number) => formatMoneyCompact(value, currency)} />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Legend
          verticalAlign="top"
          height={30}
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}
        />

        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={SERIES.revenue} strokeWidth={2} fill="url(#fill-revenue)" />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke={SERIES.expenses} strokeWidth={2} fill="url(#fill-expenses)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProfitBarChart({
  data,
  currency = 'INR',
  height = 240,
}: {
  data: TrendPoint[];
  currency?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={64} tickFormatter={(value: number) => formatMoneyCompact(value, currency)} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }} />
        <Bar dataKey="profit" name="Net profit" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((point) => (
            // A loss is a materially different fact from a small profit, so it
            // gets its own colour rather than just a shorter bar.
            <Cell key={point.label} fill={point.profit >= 0 ? SERIES.profit : 'var(--color-danger)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({
  data,
  currency = 'INR',
  height = 240,
}: {
  data: { name: string; value: number; color?: string | null }[];
  currency?: string;
  height?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="grid h-[240px] place-items-center text-xs text-muted-foreground">
        Nothing to chart yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width="100%" height={height} className="max-w-[220px]">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((item, index) => (
              <Cell key={item.name} fill={item.color ?? CATEGORICAL[index % CATEGORICAL.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>

      {/* A legend list carries the values too — a donut alone can't be read precisely. */}
      <ul className="w-full flex-1 space-y-1.5">
        {data.slice(0, 7).map((item, index) => (
          <li key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? CATEGORICAL[index % CATEGORICAL.length] }}
              />
              <span className="truncate text-muted-foreground">{item.name}</span>
            </span>
            <span className="shrink-0 font-medium tabular">
              {((item.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgingBarChart({
  aging,
  currency = 'INR',
}: {
  aging: Record<string, number>;
  currency?: string;
}) {
  const LABELS: Record<string, string> = {
    current: 'Not due',
    days1to30: '1–30 days',
    days31to60: '31–60',
    days61to90: '61–90',
    over90: '90+ days',
  };

  // Redder as it ages — the visual encodes urgency without needing a legend.
  const COLORS: Record<string, string> = {
    current: 'var(--color-chart-3)',
    days1to30: 'var(--color-chart-4)',
    days31to60: 'var(--color-chart-4)',
    days61to90: 'var(--color-danger)',
    over90: 'var(--color-danger)',
  };

  const data = Object.entries(LABELS).map(([key, name]) => ({
    name,
    value: aging[key] ?? 0,
    color: COLORS[key],
  }));

  if (data.every((item) => item.value === 0)) {
    return (
      <div className="grid h-[200px] place-items-center text-xs text-muted-foreground">
        Nothing outstanding — everything is collected
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(value: number) => formatMoneyCompact(value, currency)} />
        <YAxis type="category" dataKey="name" {...axisProps} width={72} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }} />
        <Bar dataKey="value" name="Outstanding" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
