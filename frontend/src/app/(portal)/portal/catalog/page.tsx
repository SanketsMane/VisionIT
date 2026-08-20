'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import {
  WORK_CATEGORY_LABELS,
  catalogApi,
  deliveredLabel,
  type WorkCategory,
} from '@/lib/api/public.api';
import { cn } from '@/lib/utils';

/**
 * Everything the studio has built, category by category.
 *
 * Shown only to people who signed up through the website — an invited client
 * came for their own project, not a portfolio. Reads the same endpoint the
 * public site does, so there is nothing here a visitor could not already see.
 */
export default function PortalCatalogPage() {
  const [category, setCategory] = useState<WorkCategory | 'ALL'>('ALL');

  const catalog = useQuery({
    queryKey: ['portal', 'catalog'],
    queryFn: () => catalogApi.work(),
    staleTime: 5 * 60 * 1000,
  });

  const items = catalog.data?.items ?? [];
  const shown = useMemo(
    () => (category === 'ALL' ? items : items.filter((item) => item.category === category)),
    [items, category],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalog"
        description="Everything we have designed, built and delivered."
      />

      {catalog.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : catalog.isError ? (
        <ErrorState onRetry={() => void catalog.refetch()} />
      ) : !items.length ? (
        <EmptyState
          icon={Boxes}
          title="Nothing published yet"
          description="Our case studies are being written up. Message us and we will talk you through comparable work."
          className="py-12"
          action={
            <Button asChild>
              <Link href="/portal/messages">Message us</Link>
            </Button>
          }
        />
      ) : (
        <>
          {catalog.data && catalog.data.categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Chip active={category === 'ALL'} onClick={() => setCategory('ALL')}>
                Everything <span className="ml-1 opacity-70">{items.length}</span>
              </Chip>
              {catalog.data.categories.map((row) => (
                <Chip
                  key={row.category}
                  active={category === row.category}
                  onClick={() => setCategory(row.category)}
                >
                  {WORK_CATEGORY_LABELS[row.category]}
                  <span className="ml-1 opacity-70">{row.count}</span>
                </Chip>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((item) => {
              const delivered = deliveredLabel(item.deliveredAt);
              return (
                <Link
                  key={item.id}
                  href={`/portal/catalog/${item.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
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
                      <div className="grid size-full place-items-center bg-gradient-to-br from-primary/12 to-primary/4">
                        <span className="text-3xl font-bold text-primary/40">
                          {item.title.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-2.5 top-2.5 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                      {WORK_CATEGORY_LABELS[item.category]}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.liveUrl && (
                        <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                      {item.tagline}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                      {item.industry && <span>{item.industry}</span>}
                      {item.industry && delivered && <span aria-hidden>·</span>}
                      {delivered && <span>{delivered}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
            <p className="text-sm font-semibold">Want something like this?</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
              Tell us what you need and we will come back with an approach and a price.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button asChild size="sm">
                <Link href="/portal/messages">
                  Message us
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/portal/services">Browse services</Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
