'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  WORK_CATEGORY_LABELS,
  deliveredLabel,
  publicApi,
  type WorkItem,
} from '@/lib/api/public.api';

/**
 * A row of recent work on the homepage.
 *
 * Renders nothing at all when the catalog is empty. A "no projects yet"
 * placeholder on a studio's own homepage actively damages the pitch, so the
 * section simply is not there until there is something to show.
 */
export function WorkStrip() {
  const work = useQuery({
    queryKey: ['public', 'work', 'strip'],
    queryFn: () => publicApi.work(),
    staleTime: 5 * 60 * 1000,
  });

  if (work.isLoading) {
    return (
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Skeleton className="h-8 w-56" />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const items = work.data?.items ?? [];
  if (!items.length) return null;

  return (
    <section className="border-t border-border py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Recent work</h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              Products we designed, built and put live.
            </p>
          </div>
          <Link
            href="/work"
            className="group inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            See everything
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 3).map((item) => (
            <WorkCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkCard({ item, href }: { item: WorkItem; href?: string }) {
  const delivered = deliveredLabel(item.deliveredAt);

  return (
    <Link
      href={href ?? `/work/${item.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {item.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImage}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          // No screenshot yet: the initial on a tinted panel beats a broken
          // image icon or a grey rectangle.
          <div className="grid size-full place-items-center bg-gradient-to-br from-primary/12 to-primary/4">
            <span className="text-4xl font-bold text-primary/40">{item.title.charAt(0)}</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
          {WORK_CATEGORY_LABELS[item.category]}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{item.title}</h3>
          {item.liveUrl && <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{item.tagline}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {item.industry && <span>{item.industry}</span>}
          {item.industry && delivered && <span aria-hidden>·</span>}
          {delivered && <span>{delivered}</span>}
        </div>
      </div>
    </Link>
  );
}
