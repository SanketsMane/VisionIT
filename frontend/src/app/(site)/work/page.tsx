'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { WorkCard } from '@/components/site/work-strip';
import { WORK_CATEGORY_LABELS, publicApi, type WorkCategory } from '@/lib/api/public.api';
import { cn } from '@/lib/utils';
import { Boxes } from 'lucide-react';
import { PageHero } from '@/components/site/page-hero';

/**
 * Everything we have built, filterable by the kind of work.
 *
 * Filtering happens in the browser over the full list rather than by refetching
 * per category: the catalog is small, and a network round-trip to hide six
 * cards is a worse experience than an instant one.
 */
export default function WorkPage() {
  const [category, setCategory] = useState<WorkCategory | 'ALL'>('ALL');

  const work = useQuery({
    queryKey: ['public', 'work'],
    queryFn: () => publicApi.work(),
    staleTime: 5 * 60 * 1000,
  });

  const items = work.data?.items ?? [];
  const shown = useMemo(
    () => (category === 'ALL' ? items : items.filter((item) => item.category === category)),
    [items, category],
  );

  return (
    <>
      <PageHero
        eyebrow="Selected work"
        title="Products we designed, built and put live"
        description="Across web, mobile, trading and AI — each one shipped, supported and still running."
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">

      {work.isLoading ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : work.isError ? (
        <div className="mt-10">
          <ErrorState onRetry={() => void work.refetch()} />
        </div>
      ) : !items.length ? (
        <div className="mt-10">
          <EmptyState
            icon={Boxes}
            title="Nothing published yet"
            description="Our case studies are being written up. In the meantime, tell us what you need and we will talk you through comparable work."
            className="py-16"
          />
        </div>
      ) : (
        <>
          {work.data && work.data.categories.length > 1 && (
            <div className="mt-9 flex flex-wrap gap-2">
              <FilterChip active={category === 'ALL'} onClick={() => setCategory('ALL')}>
                Everything
                <span className="ml-1.5 text-[11px] opacity-70">{items.length}</span>
              </FilterChip>
              {work.data.categories.map((row) => (
                <FilterChip
                  key={row.category}
                  active={category === row.category}
                  onClick={() => setCategory(row.category)}
                >
                  {WORK_CATEGORY_LABELS[row.category]}
                  <span className="ml-1.5 text-[11px] opacity-70">{row.count}</span>
                </FilterChip>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <WorkCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
      </div>
    </>
  );
}

function FilterChip({
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
        'inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
