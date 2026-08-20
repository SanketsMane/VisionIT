'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ExternalLink, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/empty-state';
import { WORK_CATEGORY_LABELS, deliveredLabel, publicApi } from '@/lib/api/public.api';

/** One piece of work, in full. */
export default function WorkDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const item = useQuery({
    queryKey: ['public', 'work', slug],
    queryFn: () => publicApi.workItem(slug),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (item.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-6 h-12 w-full" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (item.isError || !item.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <ErrorState
          title="We could not find that"
          message="It may have been unpublished, or the link may be wrong."
        />
        <div className="mt-6 text-center">
          <Button asChild variant="outline">
            <Link href="/work">
              <ArrowLeft />
              Back to all work
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const work = item.data;
  const delivered = deliveredLabel(work.deliveredAt);

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <Link
        href="/work"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All work
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-md bg-primary-muted px-2 py-1 font-medium text-primary">
            {WORK_CATEGORY_LABELS[work.category]}
          </span>
          {work.industry && <span>{work.industry}</span>}
          {delivered && <span>Delivered {delivered}</span>}
        </div>

        <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {work.title}
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          {work.tagline}
        </p>

        {work.liveUrl && (
          <Button asChild className="mt-6" variant="outline">
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
          className="mt-10 w-full rounded-2xl border border-border object-cover"
        />
      )}

      {work.summary && (
        <div className="mt-10 space-y-4">
          {/* Paragraph breaks are preserved from the stored text; the copy is
              written in the admin editor, not authored as HTML. */}
          {work.summary.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index} className="text-pretty leading-relaxed text-foreground/90">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {work.highlights.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            What it does
          </h2>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {work.highlights.map((highlight) => (
              <li
                key={highlight}
                className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5 text-sm"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {highlight}
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.techStack.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Built with
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {work.techStack.map((tech) => (
              <li
                key={tech}
                className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium"
              >
                {tech}
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.gallery.length > 0 && (
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {work.gallery.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image}
              src={image}
              alt=""
              className="w-full rounded-xl border border-border object-cover"
            />
          ))}
        </section>
      )}

      {work.testimonial && (
        <blockquote className="mt-10 rounded-2xl border border-border bg-muted/40 p-6">
          <Quote className="size-5 text-primary" />
          <p className="mt-3 text-pretty leading-relaxed italic">{work.testimonial}</p>
          {work.clientLabel && (
            <footer className="mt-3 text-sm font-medium text-muted-foreground">
              — {work.clientLabel}
            </footer>
          )}
        </blockquote>
      )}

      <section className="mt-14 rounded-2xl border border-border bg-muted/40 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Want something like this?</h2>
        <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Create an account to browse everything we have built, price up a service and message us
          directly.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/register">
              Create an account
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Send us a message</Link>
          </Button>
        </div>
      </section>
    </article>
  );
}
