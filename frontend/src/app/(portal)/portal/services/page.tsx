'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, ArrowLeft, PackageCheck, Sparkles,
  Code2, CandlestickChart, Bot, Server, MessageSquareText, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { ServiceIcon } from '@/components/modules/services/service-icon';
import { OrderDialog } from '@/components/modules/services/order-dialog';
import { CATEGORY_LABELS, ordersApi, type Service, type ServiceCategory } from '@/lib/api/services.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { cn } from '@/lib/utils';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * Groups shown to clients, in the order they are most often wanted.
 *
 * A curated list rather than every enum value: the client picks a need, not a
 * database category, and an empty group is worse than a missing one.
 */
const GROUPS: {
  key: string; label: string; blurb: string; icon: LucideIcon; categories: ServiceCategory[];
}[] = [
  {
    key: 'build',
    label: 'Build something',
    blurb: 'Web, mobile, AI and fintech products built end to end.',
    icon: Code2,
    categories: ['WEB_DEVELOPMENT', 'ANDROID_APP', 'IOS_APP', 'AI_SOFTWARE', 'FINTECH_PLATFORM'],
  },
  {
    key: 'trading',
    label: 'Trading systems',
    blurb: 'Broker platforms, algos, Pine Script, MT5 and copy trading.',
    icon: CandlestickChart,
    categories: ['TRADING_PLATFORM', 'ALGO_TRADING'],
  },
  {
    key: 'ai',
    label: 'Vision AI',
    blurb: 'Chat and calling agents, automation, image and video generation.',
    icon: Bot,
    categories: ['AI_AGENT', 'AUTOMATION', 'MEDIA_GENERATION'],
  },
  {
    key: 'hosting',
    label: 'Hosting',
    blurb: 'Servers we set up, secure and keep running for you.',
    icon: Server,
    categories: ['VPS_HOSTING', 'WINDOWS_HOSTING'],
  },
  {
    key: 'messaging',
    label: 'Bulk SMS',
    blurb: 'Transactional and promotional SMS. No DLT registration.',
    icon: MessageSquareText,
    categories: ['SMS_SERVICE'],
  },
  {
    key: 'growth',
    label: 'Grow it',
    blurb: 'Marketing, SEO and lead generation once it is live.',
    icon: TrendingUp,
    categories: ['SOCIAL_MEDIA', 'DIGITAL_MARKETING', 'SEO', 'LEAD_GENERATION'],
  },
];

/**
 * The client's view of what they can buy.
 *
 * Category first, then services: showing eleven cards at once asks the client
 * to do the sorting, and most of them are irrelevant to why they came.
 */
export default function PortalServicesPage() {
  const [group, setGroup] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<Service | null>(null);

  const catalog = useQuery({ queryKey: queryKeys.services.catalog, queryFn: ordersApi.catalog });
  const orders = useQuery({ queryKey: queryKeys.services.myOrders, queryFn: ordersApi.mine });

  const active = GROUPS.find((g) => g.key === group) ?? null;
  const services = useMemo(() => {
    const all = catalog.data ?? [];
    return active ? all.filter((s) => active.categories.includes(s.category)) : [];
  }, [catalog.data, active]);

  const openOrders = (orders.data ?? []).filter((o) => o.status !== 'CANCELLED');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Everything we offer, and what it costs."
        actions={
          openOrders.length > 0 ? (
            <Button asChild variant="outline">
              <Link href="/portal/services/orders">
                <PackageCheck /> My orders
                <Badge variant="primary" size="sm" className="ml-1">{openOrders.length}</Badge>
              </Link>
            </Button>
          ) : undefined
        }
      />

      {catalog.isError ? (
        <Card><ErrorState onRetry={() => void catalog.refetch()} /></Card>
      ) : catalog.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !active ? (
        /* ── Step 1: what do you need? ─────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-3">
          {GROUPS.map((option) => {
            const count = (catalog.data ?? []).filter((s) => option.categories.includes(s.category)).length;
            if (!count) return null;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setGroup(option.key)}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-soft"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-primary-muted text-primary">
                  <option.icon className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{option.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{option.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {count} {count === 1 ? 'option' : 'options'}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Step 2: pick one ──────────────────────────────────────── */
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setGroup(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> All categories
          </button>

          <div>
            <h2 className="text-sm font-semibold">{active.label}</h2>
            <p className="text-xs text-muted-foreground">{active.blurb}</p>
          </div>

          {services.length === 0 ? (
            <Card><EmptyState icon={Sparkles} title="Nothing here yet" className="py-12" /></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <Card key={service.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col p-4">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-lg"
                      style={{
                        backgroundColor: `${service.accentColor ?? '#0076FF'}18`,
                        color: service.accentColor ?? '#0076FF',
                      }}
                    >
                      <ServiceIcon name={service.icon} className="size-5" />
                    </span>

                    <p className="mt-3 text-sm font-semibold">{service.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{service.tagline}</p>
                    {service.priceNote && (
                      <Badge variant="success" size="sm" className="mt-2 w-fit">{service.priceNote}</Badge>
                    )}

                    <ul className="mt-3 flex-1 space-y-1.5">
                      {service.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs">
                        {service.pricingModel === 'SLAB' ? (
                          <>
                            <span className="text-muted-foreground">from </span>
                            <span className="font-semibold">
                              ₹{service.startingPrice?.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {' '}per {service.unitLabel ?? 'unit'}
                            </span>
                          </>
                        ) : service.startingPrice ? (
                          <>
                            <span className="text-muted-foreground">from </span>
                            <span className="font-semibold">{rupees(service.startingPrice)}</span>
                            <span className="text-[10px] text-muted-foreground">{service.priceSuffix}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Priced per project</span>
                        )}
                      </span>
                      <Button size="sm" onClick={() => setOrdering(service)}>
                        {service.pricingModel === 'SLAB'
                          ? 'Buy credits'
                          : service.plans.length
                            ? 'Choose a plan'
                            : 'Get a quote'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <OrderDialog
        service={ordering}
        open={Boolean(ordering)}
        onOpenChange={(next: boolean) => !next && setOrdering(null)}
      />
    </div>
  );
}
