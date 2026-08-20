'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight, Bot, CandlestickChart, Code2, MessageSquareText, Server, TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { publicApi } from '@/lib/api/public.api';
import type { ServiceCategory } from '@/lib/api/services.api';
import { Reveal } from './reveal';
import { SectionHeading } from './section';
import { cn } from '@/lib/utils';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * The six things the studio sells, each linked to its section on /services.
 *
 * Prices are read from the live catalog rather than written here, so the
 * homepage cannot quote a rate the services page has since changed.
 */
const GROUPS: {
  id: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  categories: ServiceCategory[];
  span?: boolean;
}[] = [
  {
    id: 'build',
    label: 'Software development',
    blurb:
      'Web platforms, Android and iOS apps, AI software and fintech products — architected, built and shipped by the team that will support them.',
    icon: Code2,
    categories: ['WEB_DEVELOPMENT', 'ANDROID_APP', 'IOS_APP', 'AI_SOFTWARE', 'FINTECH_PLATFORM'],
    span: true,
  },
  {
    id: 'trading',
    label: 'Trading systems',
    blurb: 'Broker platforms, algorithmic strategies, Pine Script, MT5 expert advisors, copy trading.',
    icon: CandlestickChart,
    categories: ['TRADING_PLATFORM', 'ALGO_TRADING'],
  },
  {
    id: 'ai',
    label: 'Vision AI',
    blurb: 'Support chat agents, AI calling agents, business automation, image and video generation.',
    icon: Bot,
    categories: ['AI_AGENT', 'AUTOMATION', 'MEDIA_GENERATION'],
  },
  {
    id: 'hosting',
    label: 'Hosting & infrastructure',
    blurb: 'AMD EPYC servers, NVMe storage, Linux and Windows — set up, secured and monitored.',
    icon: Server,
    categories: ['VPS_HOSTING', 'WINDOWS_HOSTING'],
    span: true,
  },
  {
    id: 'messaging',
    label: 'Bulk SMS',
    blurb: 'Transactional and promotional SMS across India. Rates fall as volume rises, and no DLT registration to clear first.',
    icon: MessageSquareText,
    categories: ['SMS_SERVICE'],
    span: true,
  },
  {
    id: 'growth',
    label: 'Growth',
    blurb: 'Social media, digital marketing, SEO and lead generation for after launch.',
    icon: TrendingUp,
    categories: ['SOCIAL_MEDIA', 'DIGITAL_MARKETING', 'SEO', 'LEAD_GENERATION'],
  },
];

export function Capabilities() {
  const services = useQuery({
    queryKey: ['public', 'services'],
    queryFn: () => publicApi.services(),
    staleTime: 5 * 60 * 1000,
  });

  const groups = useMemo(() => {
    const all = services.data ?? [];
    return GROUPS.map((group) => {
      const mine = all.filter((service) => group.categories.includes(service.category));
      const priced = mine
        .map((service) => service.startingPrice)
        .filter((price): price is number => typeof price === 'number' && price > 0);
      const slab = mine.find((service) => service.pricingModel === 'SLAB');

      return {
        ...group,
        count: mine.length,
        from: slab
          ? `from ₹${slab.startingPrice?.toFixed(2)} / ${slab.unitLabel ?? 'unit'}`
          : priced.length
            ? `from ${rupees(Math.min(...priced))}`
            : 'Priced per project',
      };
    }).filter((group) => group.count > 0);
  }, [services.data]);

  return (
    <>
      <SectionHeading
        eyebrow="What we do"
        title="One team, the whole stack"
        description="From the first architecture call to the server it runs on a year later — without handing you between agencies."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group, index) => (
          <Reveal
            key={group.id}
            delay={index * 60}
            className={cn(group.span && 'lg:col-span-2')}
          >
            <Link
              href={`/services#${group.id}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-raised"
            >
              {/* A wash that only appears on hover — enough to signal the card
                  is a target without competing with the text at rest. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />

              <div className="relative flex items-start justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-soft">
                  <group.icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>

              <h3 className="relative mt-5 text-lg font-semibold tracking-tight">{group.label}</h3>
              <p className="relative mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {group.blurb}
              </p>

              <div className="relative mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-semibold text-primary">{group.from}</span>
                <span className="text-[11px] text-muted-foreground">
                  {group.count} {group.count === 1 ? 'service' : 'services'}
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </>
  );
}
