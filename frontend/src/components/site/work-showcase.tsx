'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WORK_CATEGORY_LABELS, deliveredLabel, publicApi } from '@/lib/api/public.api';
import { Reveal } from './reveal';
import { SectionHeading } from './section';
import { cn } from '@/lib/utils';

/**
 * Recent work, alternating left and right.
 *
 * A full-width row per project rather than a grid of thumbnails: with a small
 * portfolio, three large well-presented pieces read as a track record, while
 * three small cards in a twelve-cell grid read as a gap.
 *
 * Renders nothing when the catalog is empty — a "no work yet" placeholder on a
 * studio's homepage does more damage than an absent section.
 */
export function WorkShowcase() {
  const work = useQuery({
    queryKey: ['public', 'work', 'showcase'],
    queryFn: () => publicApi.work(),
    staleTime: 5 * 60 * 1000,
  });

  if (work.isLoading) {
    return (
      <>
        <Skeleton className="h-9 w-64" />
        <div className="mt-12 space-y-8">
          {[0, 1].map((key) => (
            <Skeleton key={key} className="h-64 rounded-2xl" />
          ))}
        </div>
      </>
    );
  }

  const items = (work.data?.items ?? []).slice(0, 3);
  if (!items.length) return null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="Selected work"
          title="Shipped, live, and still supported"
          description="Products we designed, built and put in front of real users."
        />
        <Reveal>
          <Button asChild variant="outline">
            <Link href="/work">
              View all work
              <ArrowRight />
            </Link>
          </Button>
        </Reveal>
      </div>

      <div className="mt-14 space-y-6">
        {items.map((item, index) => {
          const delivered = deliveredLabel(item.deliveredAt);
          const name = item.title.split('—')[0].trim();
          const subtitle = item.title.includes('—')
            ? item.title.split('—').slice(1).join('—').trim()
            : null;

          return (
            <Reveal key={item.id}>
              <article
                className={cn(
                  'group grid overflow-hidden rounded-3xl border border-border bg-card transition-shadow duration-300 hover:shadow-raised lg:grid-cols-2',
                  // Alternating the image side stops three stacked rows from
                  // reading as one repeated template.
                  index % 2 === 1 && 'lg:[&>a]:order-2',
                )}
              >
                <Link
                  href={`/work/${item.slug}`}
                  className="relative block overflow-hidden bg-muted"
                  aria-label={item.title}
                >
                  {item.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverImage}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/10] size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid aspect-[16/10] size-full place-items-center bg-gradient-to-br from-primary/15 via-info/10 to-transparent">
                      <span className="text-6xl font-bold text-primary/30">{name.charAt(0)}</span>
                    </div>
                  )}
                </Link>

                <div className="flex flex-col justify-center p-7 sm:p-10">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-md bg-primary-muted px-2 py-1 font-semibold text-primary">
                      {WORK_CATEGORY_LABELS[item.category]}
                    </span>
                    {item.industry && (
                      <span className="text-muted-foreground">{item.industry}</span>
                    )}
                    {delivered && <span className="text-muted-foreground">· {delivered}</span>}
                  </div>

                  <h3 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">{name}</h3>
                  {subtitle && (
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{subtitle}</p>
                  )}

                  <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                    {item.tagline}
                  </p>

                  {item.highlights.length > 0 && (
                    <ul className="mt-5 flex flex-wrap gap-1.5">
                      {item.highlights.slice(0, 3).map((highlight) => (
                        <li
                          key={highlight}
                          className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <Link
                      href={`/work/${item.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                    >
                      Read the case
                      <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                    {item.liveUrl && (
                      <a
                        href={item.liveUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Visit site
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
