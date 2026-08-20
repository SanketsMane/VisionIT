'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ExternalLink, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/empty-state';
import { WORK_CATEGORY_LABELS, catalogApi, deliveredLabel } from '@/lib/api/public.api';

/** One catalog entry, for a signed-in lead. */
export default function PortalCatalogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const item = useQuery({
    queryKey: ['portal', 'catalog', slug],
    queryFn: () => catalogApi.workItem(slug),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (item.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (item.isError || !item.data) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="We could not find that"
          message="It may have been unpublished."
        />
        <div className="text-center">
          <Button asChild variant="outline">
            <Link href="/portal/catalog">
              <ArrowLeft />
              Back to the catalog
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const work = item.data;
  const delivered = deliveredLabel(work.deliveredAt);

  return (
    <div className="space-y-6">
      <Link
        href="/portal/catalog"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Catalog
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary" size="sm">{WORK_CATEGORY_LABELS[work.category]}</Badge>
          {work.industry && <span className="text-xs text-muted-foreground">{work.industry}</span>}
          {delivered && (
            <span className="text-xs text-muted-foreground">Delivered {delivered}</span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{work.title}</h1>
        <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{work.tagline}</p>

        {work.liveUrl && (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={work.liveUrl} target="_blank" rel="noreferrer noopener">
              Visit the live site
              <ExternalLink />
            </a>
          </Button>
        )}
      </header>

      {work.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={work.coverImage}
          alt=""
          className="w-full rounded-xl border border-border object-cover"
        />
      )}

      {work.summary && (
        <Card>
          <CardContent className="space-y-3 p-5">
            {work.summary.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index} className="text-pretty text-sm leading-relaxed">
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {work.highlights.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">What it does</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {work.highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs"
              >
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                {highlight}
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.techStack.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">Built with</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {work.techStack.map((tech) => (
              <li
                key={tech}
                className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium"
              >
                {tech}
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.gallery.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {work.gallery.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image}
              src={image}
              alt=""
              className="w-full rounded-lg border border-border object-cover"
            />
          ))}
        </section>
      )}

      {work.testimonial && (
        <blockquote className="rounded-xl border border-border bg-muted/40 p-5">
          <Quote className="size-4 text-primary" />
          <p className="mt-2 text-pretty text-sm italic leading-relaxed">{work.testimonial}</p>
          {work.clientLabel && (
            <footer className="mt-2 text-xs font-medium text-muted-foreground">
              — {work.clientLabel}
            </footer>
          )}
        </blockquote>
      )}

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm font-semibold">Want something like this?</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            Send us a note and we will come back with an approach and a price.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/portal/messages">
              Message us
              <ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
