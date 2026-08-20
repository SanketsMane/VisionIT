import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortalMockup } from './portal-mockup';

/**
 * The first screen.
 *
 * Shows the studio's own product rather than its clients' — the work has a
 * dedicated section further down, and putting the same two screenshots in both
 * places made the hero read as a gallery and the page as a repeat.
 *
 * What the hero shows instead is the portal, which is the one claim in the
 * headline a visitor cannot verify anywhere else on the page.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* ── Backdrop ──────────────────────────────────────────────────────
          A grid for structure, a colour wash for depth, and a fade at the
          bottom so the section ends rather than simply stopping. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-border)_60%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-border)_60%,transparent)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_90%_70%_at_30%_0%,#000_45%,transparent_100%)]" />
        <div className="absolute left-[-8rem] top-[-16rem] size-[38rem] rounded-full bg-primary/12 blur-[120px]" />
        <div className="absolute right-[-12rem] top-[2rem] size-[32rem] rounded-full bg-info/10 blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* ── Copy ─────────────────────────────────────────────────── */}
          <div className="text-center lg:text-left">
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

            <h1 className="mt-7 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              We build software that{' '}
              <span className="bg-gradient-to-r from-primary via-info to-primary bg-clip-text text-transparent">
                outlives the handover.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              Web platforms, mobile apps, trading systems and AI products — designed, built,
              deployed and supported by one team. You get a login on day one and watch it happen.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild size="lg">
                <Link href="/register">
                  Start a project
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/work">
                  <Sparkles />
                  See our work
                </Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start">
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

          {/* ── Product ──────────────────────────────────────────────── */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <PortalMockup />
            <p className="mt-5 text-center text-xs text-muted-foreground lg:text-left">
              The client portal every project ships with — progress, invoices, testing and files,
              in one place.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
