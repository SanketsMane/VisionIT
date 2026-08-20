'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes, Inbox, MessageSquareQuote, PackageCheck, Tag, TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { PricingTable } from '@/components/modules/services/pricing-table';
import { ServiceIcon } from '@/components/modules/services/service-icon';
import { QuoteDialog, type QuoteTarget } from '@/components/modules/services/quote-dialog';
import {
  CATEGORY_LABELS, servicesApi,
  type AppliedCoupon, type Service, type ServicePlan,
} from '@/lib/api/services.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { cn } from '@/lib/utils';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * The studio's view of what it sells.
 *
 * Shows the catalog exactly as a visitor sees it — same pricing component,
 * same coupon box — so the numbers can be checked without opening a second
 * browser or guessing what the public page renders.
 */
export default function ServicesPage() {
  const [target, setTarget] = useState<QuoteTarget | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const services = useQuery({
    queryKey: queryKeys.services.list({ includeInactive: true }),
    queryFn: () => servicesApi.list({ includeInactive: true }),
  });

  const stats = useQuery({ queryKey: queryKeys.services.stats, queryFn: servicesApi.stats });
  const coupons = useQuery({ queryKey: queryKeys.services.coupons, queryFn: servicesApi.coupons });

  const items = services.data ?? [];
  const tiered = useMemo(() => items.filter((s) => s.plans.length > 0), [items]);
  // Slab services price by volume, so "from ₹0.3" tells the reader nothing.
  // They get the full band table instead.
  const slabbed = useMemo(() => items.filter((s) => s.pricingModel === 'SLAB' && s.slabs.length > 0), [items]);
  const flat = useMemo(
    () => items.filter((s) => s.plans.length === 0 && !(s.pricingModel === 'SLAB' && s.slabs.length > 0)),
    [items],
  );

  const openQuote = (service: Service, plan?: ServicePlan, termMonths?: number, coupon?: AppliedCoupon | null) => {
    setTarget({ service, plan, termMonths, coupon });
    setQuoteOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="What you sell, what it costs, and the enquiries it brings in."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/services/orders"><PackageCheck /> Orders</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/services/quotes"><Inbox /> Enquiries</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active services" value={stats.data?.activeServices ?? 0} format="number" icon={Boxes} tone="primary" />
        <StatCard
          label="New enquiries"
          value={stats.data?.newQuotes ?? 0}
          format="number"
          icon={MessageSquareQuote}
          tone={(stats.data?.newQuotes ?? 0) > 0 ? 'warning' : 'default'}
          hint={(stats.data?.newQuotes ?? 0) > 0 ? 'Waiting on a reply' : 'All answered'}
        />
        <StatCard label="Total enquiries" value={stats.data?.totalQuotes ?? 0} format="number" icon={Inbox} />
        <StatCard
          label="Won"
          value={stats.data?.wonQuotes ?? 0}
          format="number"
          icon={TrendingUp}
          tone="success"
          hint={`${stats.data?.conversionRate ?? 0}% conversion`}
        />
      </div>

      {coupons.data && coupons.data.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Tag className="size-3.5" /> Live coupons
            </span>
            {coupons.data.map((coupon) => (
              <Badge key={coupon.id} variant={coupon.isActive ? 'success' : 'outline'} size="sm">
                {coupon.code} · {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}%` : rupees(coupon.discountValue)} off
                {coupon.usageLimit ? ` · ${coupon.usedCount}/${coupon.usageLimit} used` : coupon.usedCount ? ` · ${coupon.usedCount} used` : ''}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {services.isError ? (
        <Card><ErrorState onRetry={() => void services.refetch()} /></Card>
      ) : services.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title="No services yet"
            description="Run npm run db:seed:services to load the catalog."
            className="py-16"
          />
        </Card>
      ) : (
        <>
          {/* ── Priced tiers ─────────────────────────────────────────── */}
          {tiered.map((service) => (
            <Card key={service.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid size-9 place-items-center rounded-lg"
                      style={{
                        backgroundColor: `${service.accentColor ?? '#0076FF'}18`,
                        color: service.accentColor ?? '#0076FF',
                      }}
                    >
                      <ServiceIcon name={service.icon} className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{service.name}</p>
                      <p className="text-[11px] text-muted-foreground">{service.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" size="sm">{CATEGORY_LABELS[service.category]}</Badge>
                    {!service.isPublic && <Badge variant="warning" size="sm">Hidden</Badge>}
                    {!service.isActive && <Badge variant="danger" size="sm">Inactive</Badge>}
                  </div>
                </div>

                <PricingTable
                  service={service}
                  onRequestQuote={(plan, term, coupon) => openQuote(service, plan, term, coupon)}
                />
              </CardContent>
            </Card>
          ))}

          {/* ── Everything else ──────────────────────────────────────── */}
          {slabbed.map((service) => (
            <div key={service.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="grid size-7 place-items-center rounded-lg"
                    style={{
                      backgroundColor: `${service.accentColor ?? '#0076FF'}18`,
                      color: service.accentColor ?? '#0076FF',
                    }}
                  >
                    <ServiceIcon name={service.icon} className="size-3.5" />
                  </span>
                  <h2 className="text-sm font-semibold">{service.name}</h2>
                  {!service.isActive && <Badge variant="default" size="sm">Inactive</Badge>}
                </div>
                {service.minOrderAmount !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    Minimum top-up {rupees(service.minOrderAmount)}
                  </span>
                )}
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="px-4 py-2.5 font-medium">Top-up</th>
                          <th className="px-4 py-2.5 text-right font-medium">
                            Rate per {service.unitLabel ?? 'unit'}
                          </th>
                          <th className="px-4 py-2.5 text-right font-medium">Validity</th>
                          <th className="px-4 py-2.5 text-right font-medium">
                            {service.unitLabel ? `${service.unitLabel}s at the band floor` : 'Units at the band floor'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...service.slabs]
                          .sort((a, b) => a.minAmount - b.minAmount)
                          .map((slab) => {
                            // A band may open below the minimum top-up. Quote the
                            // floor a buyer can actually reach, not the rate card's.
                            const floor = Math.max(slab.minAmount, service.minOrderAmount ?? 0);
                            return (
                            <tr key={slab.minAmount} className="border-b border-border last:border-0">
                              <td className="px-4 py-2.5 font-medium">
                                {slab.maxAmount === null
                                  ? `${rupees(floor)} and above`
                                  : `${rupees(floor)} – ${rupees(slab.maxAmount)}`}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                                ₹{slab.unitPrice.toFixed(2)}
                              </td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground">
                                {slab.validityLabel ?? '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                                {Math.floor(floor / slab.unitPrice).toLocaleString('en-IN')}
                              </td>
                            </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {service.priceNote && (
                    <p className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                      {service.priceNote}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}

          <div>
            <h2 className="mb-3 text-sm font-semibold">Services &amp; retainers</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {flat.map((service) => (
                <Card key={service.id} className={cn('flex flex-col', !service.isActive && 'opacity-60')}>
                  <CardContent className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-lg"
                        style={{
                          backgroundColor: `${service.accentColor ?? '#0076FF'}18`,
                          color: service.accentColor ?? '#0076FF',
                        }}
                      >
                        <ServiceIcon name={service.icon} className="size-4" />
                      </span>
                      {service.isFeatured && <Badge variant="primary" size="sm">Featured</Badge>}
                    </div>

                    <p className="mt-2.5 text-sm font-semibold">{service.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{service.tagline}</p>

                    <ul className="mt-3 flex-1 space-y-1">
                      {service.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
                          <span className="line-clamp-1">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs font-semibold">
                        {service.startingPrice
                          ? <>from {rupees(service.startingPrice)}<span className="text-[10px] font-normal text-muted-foreground">{service.priceSuffix}</span></>
                          : <span className="text-muted-foreground">Quote only</span>}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => openQuote(service)}>
                        Get a quote
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      <QuoteDialog target={target} open={quoteOpen} onOpenChange={setQuoteOpen} />
    </div>
  );
}
