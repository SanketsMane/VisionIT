'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, LifeBuoy, Mail, Phone, ShieldCheck, TimerReset } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { SupportState, SupportSummary } from '@/lib/api/support.api';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const split = (ms: number): Remaining => {
  const total = Math.max(0, ms);
  return {
    days: Math.floor(total / DAY),
    hours: Math.floor((total % DAY) / HOUR),
    minutes: Math.floor((total % HOUR) / MINUTE),
    seconds: Math.floor((total % MINUTE) / SECOND),
    total,
  };
};

/**
 * Ticks down to a deadline once per second.
 *
 * The remaining time is measured against the *server's* clock, not the
 * browser's: the API sends its own `now` alongside the deadline, we take the
 * difference once, and every tick after that applies the same offset. A laptop
 * with a clock two days fast would otherwise tell a client their support had
 * already run out.
 *
 * The interval is re-derived from wall-clock time on every tick rather than
 * decremented, so a backgrounded tab — where timers are throttled — catches up
 * instantly instead of drifting behind by however long it was asleep.
 */
function useCountdown(endDate: string | null, serverTime: string, active: boolean): Remaining {
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);

  const target = useMemo(() => (endDate ? new Date(endDate).getTime() : 0), [endDate]);

  const [remaining, setRemaining] = useState<Remaining>(() =>
    split(target ? target - (Date.now() + offsetRef.current) : 0),
  );

  useEffect(() => {
    if (!target || !active) return;

    const tick = () => setRemaining(split(target - (Date.now() + offsetRef.current)));
    tick();

    const id = window.setInterval(tick, SECOND);
    // A throttled background tab can miss ticks entirely; recompute the moment
    // it comes back so the numbers are never visibly stale.
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [target, active]);

  return remaining;
}

const TONE: Record<SupportState, { ring: string; text: string; badge: 'success' | 'warning' | 'danger' | 'outline' | 'primary' }> = {
  ACTIVE:         { ring: 'stroke-success',  text: 'text-success',  badge: 'success' },
  EXPIRING_SOON:  { ring: 'stroke-warning',  text: 'text-warning',  badge: 'warning' },
  EXPIRED:        { ring: 'stroke-danger',   text: 'text-danger',   badge: 'danger'  },
  CANCELLED:      { ring: 'stroke-danger',   text: 'text-danger',   badge: 'danger'  },
  SCHEDULED:      { ring: 'stroke-primary',  text: 'text-primary',  badge: 'primary' },
  NOT_CONFIGURED: { ring: 'stroke-muted',    text: 'text-muted-foreground', badge: 'outline' },
};

function Unit({ value, label, tone }: { value: number; label: string; tone: string }) {
  const text = String(value).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div
        className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
        // Tabular figures stop the box from jittering as digits change width.
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <span className={cn('block text-2xl font-bold leading-none sm:text-3xl', tone)}>{text}</span>
      </div>
      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/** Circular progress showing how much of the term has been used. */
function Ring({ percent, tone, children }: { percent: number; tone: string; children: React.ReactNode }) {
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative grid size-28 shrink-0 place-items-center">
      <svg viewBox="0 0 104 104" className="absolute size-full -rotate-90">
        <circle cx="52" cy="52" r={R} className="fill-none stroke-border" strokeWidth="7" />
        <circle
          cx="52" cy="52" r={R}
          className={cn('fill-none transition-[stroke-dashoffset] duration-700', tone)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * Math.min(100, Math.max(0, percent))) / 100}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/**
 * The client-facing support card.
 *
 * Renders nothing at all when no term is configured — a client who was never
 * sold support should not see an empty "support" box implying they are owed
 * something.
 */
export function SupportCountdown({ support }: { support: SupportSummary | undefined }) {
  const isLive =
    support !== undefined &&
    (support.state === 'ACTIVE' || support.state === 'EXPIRING_SOON' || support.state === 'SCHEDULED');

  const remaining = useCountdown(support?.endDate ?? null, support?.serverTime ?? '', isLive);

  if (!support || support.state === 'NOT_CONFIGURED') return null;

  const tone = TONE[support.state];
  const isOver = support.state === 'EXPIRED' || support.state === 'CANCELLED';
  const percentLeft = 100 - support.percentElapsed;

  return (
    <Card className={cn('overflow-hidden', support.state === 'EXPIRING_SOON' && 'border-warning/50')}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={cn('grid size-9 place-items-center rounded-lg bg-muted', tone.text)}>
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">
                {support.planLabel || 'Technical Support'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {support.startDate && support.endDate
                  ? `${formatDate(support.startDate)} — ${formatDate(support.endDate)}`
                  : 'Support period'}
              </p>
            </div>
          </div>

          <Badge variant={tone.badge} size="sm">{support.stateLabel}</Badge>
        </div>

        {isOver ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-center">
            <Clock className={cn('mx-auto size-6', tone.text)} />
            <p className="mt-2 text-sm font-semibold">
              {support.state === 'CANCELLED'
                ? 'This support term was cancelled'
                : 'Your support period has ended'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {support.endDate && `Cover ran until ${formatDate(support.endDate)}. `}
              Get in touch if you would like to renew — we can still help.
            </p>
          </div>
        ) : support.state === 'SCHEDULED' ? (
          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-center">
            <TimerReset className="mx-auto size-6 text-primary" />
            <p className="mt-2 text-sm font-semibold">
              Support starts on {support.startDate && formatDate(support.startDate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your {support.durationMonths}-month cover begins then.
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
            <Ring percent={percentLeft} tone={tone.ring}>
              <span className={cn('block text-xl font-bold leading-none', tone.text)}>
                {Math.max(0, support.daysRemaining ?? 0)}
              </span>
              <span className="block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                days left
              </span>
            </Ring>

            <div className="min-w-0 flex-1">
              <p className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:text-left">
                Time remaining on your support
              </p>
              <div
                // Capped so the four boxes stay a single readable group instead
                // of stretching apart on a wide screen.
                className="grid max-w-md grid-cols-4 gap-2 sm:gap-3"
                role="timer"
                aria-live="off"
                aria-label={`${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes and ${remaining.seconds} seconds of support remaining`}
              >
                <Unit value={remaining.days} label="Days" tone={tone.text} />
                <Unit value={remaining.hours} label="Hours" tone={tone.text} />
                <Unit value={remaining.minutes} label="Mins" tone={tone.text} />
                <Unit value={remaining.seconds} label="Secs" tone={tone.text} />
              </div>

              {support.state === 'EXPIRING_SOON' && (
                <p className="mt-3 rounded-lg bg-warning-muted px-3 py-2 text-[11px] leading-relaxed text-warning">
                  Your cover ends soon. Reply to any of our emails to arrange a renewal and avoid a gap.
                </p>
              )}
            </div>
          </div>
        )}

        {(support.inclusions.length > 0 || support.responseTime || support.supportEmail || support.supportPhone) && (
          <div className="mt-5 border-t border-border pt-4">
            {support.inclusions.length > 0 && (
              <>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  What&apos;s covered
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {support.inclusions.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {support.responseTime && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {support.responseTime}
                </span>
              )}
              {support.supportEmail && (
                <a href={`mailto:${support.supportEmail}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <Mail className="size-3.5" /> {support.supportEmail}
                </a>
              )}
              {support.supportPhone && (
                <a href={`tel:${support.supportPhone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <Phone className="size-3.5" /> {support.supportPhone}
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact variant for the multi-project dashboard list. */
export function SupportPill({ support }: { support: SupportSummary | undefined }) {
  if (!support || support.state === 'NOT_CONFIGURED') return null;

  const tone = TONE[support.state];
  const days = Math.max(0, support.daysRemaining ?? 0);

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', tone.text)}>
      <LifeBuoy className="size-3.5" />
      {support.state === 'EXPIRED' || support.state === 'CANCELLED'
        ? 'Support ended'
        : support.state === 'SCHEDULED'
          ? 'Support starts soon'
          : `${days} day${days === 1 ? '' : 's'} of support left`}
    </span>
  );
}
