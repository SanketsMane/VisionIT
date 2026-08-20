'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Bot, CandlestickChart, Code2, MessageSquareText, Server, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/empty-state';
import { publicApi } from '@/lib/api/public.api';
import { PageHero } from '@/components/site/page-hero';
import type { Service, ServiceCategory } from '@/lib/api/services.api';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * The same six groups the client portal uses, in the same order.
 *
 * A visitor who signs up should find the catalog laid out exactly as they just
 * saw it on the public page — a different grouping behind the login reads as a
 * different company.
 */
const GROUPS: {
  id: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  categories: ServiceCategory[];
}[] = [
  {
    id: 'build',
    label: 'Software development',
    blurb: 'Web platforms, mobile apps, AI software and fintech products, built end to end.',
    icon: Code2,
    categories: ['WEB_DEVELOPMENT', 'ANDROID_APP', 'IOS_APP', 'AI_SOFTWARE', 'FINTECH_PLATFORM'],
  },
  {
    id: 'trading',
    label: 'Trading systems',
    blurb: 'Broker platforms, algorithmic strategies, Pine Script, MT5 expert advisors and copy trading.',
    icon: CandlestickChart,
    categories: ['TRADING_PLATFORM', 'ALGO_TRADING'],
  },
  {
    id: 'ai',
    label: 'Vision AI',
    blurb: 'Chat and calling agents, business automation, image and video generation.',
    icon: Bot,
    categories: ['AI_AGENT', 'AUTOMATION', 'MEDIA_GENERATION'],
  },
  {
    id: 'hosting',
    label: 'Hosting',
    blurb: 'AMD EPYC servers with NVMe storage — set up, secured and kept running for you.',
    icon: Server,
    categories: ['VPS_HOSTING', 'WINDOWS_HOSTING'],
  },
  {
    id: 'messaging',
    label: 'Bulk SMS',
    blurb: 'Transactional and promotional SMS across India. No DLT registration required.',
    icon: MessageSquareText,
    categories: ['SMS_SERVICE'],
  },
  {
    id: 'growth',
    label: 'Growth',
    blurb: 'Social media, digital marketing, SEO and lead generation once the product is live.',
    icon: TrendingUp,
    categories: ['SOCIAL_MEDIA', 'DIGITAL_MARKETING', 'SEO', 'LEAD_GENERATION'],
  },
];

export default function PublicServicesPage() {
  const services = useQuery({
    queryKey: ['public', 'services'],
    queryFn: () => publicApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const grouped = useMemo(() => {
    const all = services.data ?? [];
    return GROUPS.map((group) => ({
      ...group,
      services: all.filter((service) => group.categories.includes(service.category)),
    })).filter((group) => group.services.length > 0);
  }, [services.data]);

  return (
    <>
      <PageHero
        eyebrow="Services"
        title="What we build, and what we run"
        description="Where a price is fixed we show it. Where the work depends on what you need, we quote — and the quote is what you pay."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">

      {services.isLoading ? (
        <div className="mt-12 space-y-10">
          {[0, 1, 2].map((key) => (
            <div key={key}>
              <Skeleton className="h-7 w-48" />
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((card) => (
                  <Skeleton key={card} className="h-44 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : services.isError ? (
        <div className="mt-12">
          <ErrorState onRetry={() => void services.refetch()} />
        </div>
      ) : (
        <div className="mt-12 space-y-16">
          {grouped.map((group) => (
            // The id is the anchor the footer links point at.
            <section key={group.id} id={group.id} className="scroll-mt-24">
              <div className="flex items-start gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-muted text-primary">
                  <group.icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{group.label}</h2>
                  <p className="mt-1 text-pretty text-sm text-muted-foreground">{group.blurb}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="mt-20 rounded-2xl border border-border bg-muted/40 p-8 text-center sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready when you are
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-pretty leading-relaxed text-muted-foreground">
          Create an account to order a service, request a quote, or just ask a question. Nothing is
          charged until you approve it.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">
              Create an account
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Ask a question</Link>
          </Button>
        </div>
      </section>
      </div>
    </>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const price =
    service.pricingModel === 'SLAB' && service.startingPrice !== null
      ? `from ₹${service.startingPrice.toFixed(2)} per ${service.unitLabel ?? 'unit'}`
      : service.startingPrice !== null
        ? `from ${rupees(service.startingPrice)}${service.priceSuffix ?? ''}`
        : 'Priced per project';

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-soft">
      <h3 className="text-sm font-semibold">{service.name}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {service.tagline}
      </p>

      {service.features.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {service.features.slice(0, 3).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 border-t border-border pt-3 text-sm font-semibold">
        {price}
      </p>
    </div>
  );
}
