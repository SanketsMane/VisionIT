import type { ReactNode } from 'react';
import { Reveal } from './reveal';
import { cn } from '@/lib/utils';

/**
 * The opening band on every inner page.
 *
 * Carries the same grid-and-glow backdrop as the homepage hero at reduced
 * intensity, so /work and /services read as the same site rather than as
 * documents that happen to share a nav bar.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative isolate overflow-hidden border-b border-border', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-border)_55%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-border)_55%,transparent)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_0%,#000_40%,transparent_100%)]" />
        <div className="absolute left-1/2 top-[-16rem] size-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="max-w-3xl">
          {eyebrow && (
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </span>
          )}
          <h1
            className={cn(
              'text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl',
              eyebrow && 'mt-5',
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
