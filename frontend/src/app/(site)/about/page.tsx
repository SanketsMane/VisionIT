import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Boxes, Gauge, HeartHandshake, MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SITE } from '@/lib/site.config';
import { PageHero } from '@/components/site/page-hero';

export const metadata: Metadata = {
  title: 'About',
  description: `How ${SITE.name} works, and what to expect when you hire us.`,
};

const PRINCIPLES = [
  {
    icon: MessagesSquare,
    title: 'You are never guessing',
    body: 'Every client gets a login on day one. Progress, invoices, testing, deliveries and files all live there, so you are never waiting on a status email to find out where things stand.',
  },
  {
    icon: Gauge,
    title: 'Agreed before it is built',
    body: 'Work is quoted, then broken into milestones you sign off as they land. Invoices match what was agreed — no line items that appear at the end.',
  },
  {
    icon: HeartHandshake,
    title: 'We are still here afterwards',
    body: 'Projects ship with a year of technical support, and the countdown runs where you can see it. Hosting we set up is hosting we keep running.',
  },
  {
    icon: Boxes,
    title: 'One team, whole stack',
    body: 'The people who design it build it, deploy it and support it. Nothing is handed to a subcontractor you never meet.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title={`We build software, then we stay`}
        description="A studio that ships web platforms, mobile apps, trading systems and AI products — and keeps them running afterwards."
      />

      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">

      <div className="mt-10 space-y-5 text-pretty leading-relaxed text-foreground/90">
        <p>
          Most software work goes wrong in the same place: the gap between what was agreed and what
          the client can actually see. Weeks pass, invoices arrive, and nobody outside the team
          knows what state anything is in.
        </p>
        <p>
          So we built the thing we would want as a client, and we run our business on it. When you
          work with us you get an account on the same platform we use to manage the project — the
          milestones, the issues you raise, the builds we deliver, the invoices, the files. It is
          not a report we generate for you. It is where the work actually happens.
        </p>
        <p>
          The rest is straightforward. We quote before we start, we build in stages you approve,
          and we stay reachable after handover.
        </p>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-bold tracking-tight">How we work</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="rounded-2xl border border-border bg-card p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-muted text-primary">
                <principle.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{principle.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-2xl border border-border bg-muted/40 p-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight">See it for yourself</h2>
        <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          Create an account and you get the same portal our clients use — browse our work, price up
          a service, and message us directly.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/register">
              Create an account
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/work">See our work</Link>
          </Button>
        </div>
      </section>
      </div>
    </>
  );
}
