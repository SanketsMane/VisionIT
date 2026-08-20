'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Play, ShieldCheck, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicApi } from '@/lib/api/public.api';
import { cn } from '@/lib/utils';

/**
 * The first screen.
 *
 * Carries a real screenshot rather than an illustration: this is a studio that
 * ships software, and the fastest way to say so is to show something it
 * actually shipped. The image comes from the published catalog, so it can never
 * show work that has been unpublished.
 */
export function Hero() {
  const work = useQuery({
    queryKey: ['public', 'work', 'hero'],
    queryFn: () => publicApi.work(),
    staleTime: 5 * 60 * 1000,
  });

  const shots = (work.data?.items ?? []).filter((item) => item.coverImage).slice(0, 3);

  return (
    <section className="relative isolate overflow-hidden">
      {/* ── Backdrop ──────────────────────────────────────────────────────
          Three layers: a grid for structure, a colour wash for depth, and a
          fade at the bottom so the section ends rather than stopping. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-border)_60%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-border)_60%,transparent)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_50%,transparent_100%)]" />
        <div className="absolute left-1/2 top-[-18rem] size-[42rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[120px]" />
        <div className="absolute right-[-10rem] top-[6rem] size-[28rem] rounded-full bg-info/10 blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/work"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/80 py-1 pl-1 pr-3 text-xs font-medium shadow-soft backdrop-blur transition-colors hover:border-primary/40"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-2 py-1 text-[11px] font-semibold text-success">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              Available
            </span>
            <span className="text-muted-foreground">Taking on new projects for 2026</span>
            <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="mt-7 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.25rem]">
            We build software that
            <br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-primary via-info to-primary bg-clip-text text-transparent">
              outlives the handover.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Web platforms, mobile apps, trading systems and AI products — designed, built,
            deployed and supported by one team. You get a login on day one and watch it happen.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/register">
                Start a project
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/work">
                <Play className="fill-current" />
                See our work
              </Link>
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-success" />
              1 year of support included
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 text-warning" />
              Fixed price, agreed upfront
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              Reply within one working day
            </span>
          </div>
        </div>

        {/* ── Work preview ────────────────────────────────────────────────
            Rendered only when there are real screenshots to show. An empty
            frame here would undercut everything the copy above claims. */}
        {shots.length > 0 && (
          <div className="relative mx-auto mt-16 max-w-5xl">
            <div
              aria-hidden
              className="absolute inset-x-8 -bottom-6 h-24 rounded-[2rem] bg-primary/12 blur-3xl"
            />
            <div className="relative grid gap-4 sm:grid-cols-3">
              {shots.map((item, index) => (
                <Link
                  key={item.id}
                  href={`/work/${item.slug}`}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border border-border bg-card shadow-raised transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-12px_rgb(16_24_40/0.18)]',
                    // The middle card sits slightly proud on wide screens, so
                    // the row reads as a composition rather than three tiles.
                    index === 1 ? 'sm:-mt-6' : '',
                    index === 2 ? 'hidden sm:block' : '',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.coverImage!}
                    alt={item.title}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    className="aspect-[16/11] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4 pt-10">
                    <p className="truncate text-sm font-semibold text-white">
                      {item.title.split('—')[0].trim()}
                    </p>
                    <p className="truncate text-[11px] text-white/70">{item.industry}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
