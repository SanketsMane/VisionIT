import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './reveal';

/** The eyebrow-heading-subhead unit every section on the site opens with. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'light',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl',
        className,
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
            tone === 'dark'
              ? 'border-white/15 bg-white/5 text-white/70'
              : 'border-primary/20 bg-primary-muted text-primary',
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          'text-balance text-3xl font-bold tracking-tight sm:text-4xl',
          eyebrow && 'mt-4',
          tone === 'dark' && 'text-white',
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'mt-4 text-pretty leading-relaxed',
            tone === 'dark' ? 'text-white/60' : 'text-muted-foreground',
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}

/** Consistent vertical rhythm and max width for every band on the page. */
export function Section({
  children,
  className,
  id,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: 'default' | 'muted' | 'dark';
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20 py-20 sm:py-28',
        tone === 'muted' && 'border-y border-border bg-muted/40',
        tone === 'dark' && 'bg-[hsl(222_47%_9%)]',
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

/**
 * Outline button styling for the dark bands.
 *
 * The `outline` variant fills with `bg-card` and `text-foreground`, which is a
 * white button on a near-black ground. These classes override both so the
 * button reads as secondary rather than shouting louder than the primary.
 */
export const DARK_OUTLINE_BUTTON =
  '!border-white/25 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white';
