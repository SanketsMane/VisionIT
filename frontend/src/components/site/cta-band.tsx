import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from './reveal';
import { DARK_OUTLINE_BUTTON } from './section';
import { SITE } from '@/lib/site.config';

/** The closing ask. One screen, two options, no form to fill in first. */
export function CtaBand() {
  return (
    <Reveal>
      <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-[hsl(222_47%_9%)] px-6 py-16 text-center sm:px-12 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-12rem] size-[34rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[110px]" />
          <div className="absolute bottom-[-14rem] right-[-6rem] size-[26rem] rounded-full bg-info/20 blur-[110px]" />
        </div>

        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Tell us what you are building
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-white/60">
          Create an account and you can browse everything we have delivered, price up a service and
          message us directly — before committing to anything.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">
              Create a free account
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className={DARK_OUTLINE_BUTTON}
          >
            <a href={`mailto:${SITE.contact.email}`}>
              <Mail />
              {SITE.contact.email}
            </a>
          </Button>
        </div>

        <p className="mt-6 text-xs text-white/40">
          No card required · {SITE.responseTime.toLowerCase()} · {SITE.hours}
        </p>
      </div>
    </Reveal>
  );
}
