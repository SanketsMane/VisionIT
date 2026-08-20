'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Sparkles, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  TERM_LABELS,
  servicesApi,
  type AppliedCoupon,
  type Service,
  type ServicePlan,
} from '@/lib/api/services.api';
import { ApiRequestError } from '@/lib/api/client';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * The hosting price grid.
 *
 * Two rules drive the whole component:
 *
 *   1. **Without a coupon it shows the list price**, struck through against the
 *      competitor figure. That is the standard rate, and showing the offer
 *      price unprompted would make the discount meaningless.
 *   2. **A coupon only ever changes the number, never the layout.** The card
 *      does not grow a new row or shift the button when a code is applied, so
 *      nothing jumps under the reader's cursor.
 */
export function PricingTable({
  service,
  onRequestQuote,
}: {
  service: Service;
  onRequestQuote: (plan: ServicePlan, termMonths: number, coupon: AppliedCoupon | null) => void;
}) {
  // Terms come from the data rather than a constant, so adding a 48-month
  // option is a price row, not a deploy.
  const terms = useMemo(() => {
    const found = new Set<number>();
    for (const plan of service.plans) for (const price of plan.prices) found.add(price.termMonths);
    return [...found].sort((a, b) => b - a);
  }, [service.plans]);

  const [term, setTerm] = useState<number>(terms[0] ?? 24);
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [applying, setApplying] = useState(false);

  const apply = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const result = await servicesApi.applyCoupon(code.trim(), service.id);
      if (!result.prices.length) {
        // A real code that happens to cover nothing here is more confusing than
        // an invalid one, so say which it is.
        toast.error('That code is valid, but not on this service');
        setCoupon(null);
      } else {
        setCoupon(result);
        toast.success(
          result.discountType === 'PERCENT'
            ? `${result.discountValue}% off applied`
            : `${rupees(result.discountValue)} off applied`,
        );
      }
    } catch (error) {
      setCoupon(null);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not apply that code');
    } finally {
      setApplying(false);
    }
  };

  const clear = () => { setCoupon(null); setCode(''); };

  const discountFor = (planId: string) =>
    coupon?.prices.find((p) => p.planId === planId && p.termMonths === term) ?? null;

  return (
    <div className="space-y-5">
      {/* ── Term switch ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {terms.map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => setTerm(months)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                term === months ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {TERM_LABELS[months] ?? `${months} months`}
              {months === Math.max(...terms) && (
                <span className="ml-1.5 text-[10px] font-semibold text-success">best value</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Coupon ────────────────────────────────────────────────── */}
        {coupon ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-muted px-3 py-1.5">
            <Tag className="size-3.5 text-success" />
            <span className="text-xs font-semibold text-success">{coupon.code}</span>
            <span className="text-[11px] text-success">
              {coupon.discountType === 'PERCENT' ? `${coupon.discountValue}% off` : `${rupees(coupon.discountValue)} off`}
            </span>
            <button type="button" onClick={clear} aria-label="Remove coupon" className="text-success/70 hover:text-success">
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') void apply(); }}
              placeholder="Coupon code"
              className="h-8 w-36 text-xs uppercase"
              aria-label="Coupon code"
            />
            <Button size="sm" variant="outline" onClick={() => void apply()} disabled={applying || !code.trim()}>
              {applying ? <Loader2 className="animate-spin" /> : 'Apply'}
            </Button>
          </div>
        )}
      </div>

      {/* ── Plans ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {service.plans.map((plan) => {
          const price = plan.prices.find((p) => p.termMonths === term);
          if (!price) return null;
          const discount = discountFor(plan.id);
          const effective = discount?.price ?? price.price;

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-xl border bg-card p-4 transition-shadow hover:shadow-soft',
                plan.isPopular ? 'border-primary shadow-soft' : 'border-border',
              )}
            >
              {plan.isPopular && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  Most popular
                </span>
              )}

              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{plan.name}</p>
                {price.discountPercent !== null && !discount && (
                  <Badge variant="success" size="sm">{price.discountPercent}% off</Badge>
                )}
                {discount && (
                  <Badge variant="success" size="sm">
                    <Sparkles className="mr-0.5 size-2.5" />
                    {coupon?.code}
                  </Badge>
                )}
              </div>

              <div className="mt-3">
                {/* Struck-through: the competitor figure normally, the list
                    price once a coupon is doing the work. */}
                <p className="text-[11px] text-muted-foreground line-through">
                  {discount
                    ? rupees(discount.listPrice)
                    : price.compareAtPrice
                      ? rupees(price.compareAtPrice)
                      : ' '}
                </p>
                <p className="flex items-baseline gap-1">
                  <span className={cn('text-2xl font-bold', discount && 'text-success')}>
                    {rupees(effective)}
                  </span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </p>
                {discount && (
                  <p className="mt-0.5 text-[11px] font-medium text-success">
                    You save {rupees(discount.amountOff)}/mo
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {rupees(effective * term)} billed for {term === 1 ? '1 month' : `${term} months`}
                  {price.renewalPrice ? ` · renews at ${rupees(price.renewalPrice)}/mo` : ''}
                </p>
              </div>

              <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
                {plan.specs.map((spec) => (
                  <div key={spec.label} className="flex items-center justify-between gap-2 text-xs">
                    <dt className="text-muted-foreground">{spec.label}</dt>
                    <dd className="font-medium">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              {plan.features.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <Check className="mt-0.5 size-3 shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                className="mt-4 w-full"
                variant={plan.isPopular ? 'primary' : 'outline'}
                onClick={() => onRequestQuote(plan, term, coupon)}
              >
                Get a quote
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
