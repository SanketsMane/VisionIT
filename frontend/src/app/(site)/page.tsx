import Link from 'next/link';
import {
  ArrowRight, Bot, CandlestickChart, Check, Code2, MessageSquareText,
  Server, ShieldCheck, TrendingUp, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkStrip } from '@/components/site/work-strip';
import { SITE } from '@/lib/site.config';

/**
 * What we do, at a glance.
 *
 * Ordered by what people actually arrive looking for rather than by what is
 * most profitable — someone who came for hosting will not read past a block
 * about algorithmic trading.
 */
const CAPABILITIES = [
  {
    icon: Code2,
    title: 'Software development',
    body: 'Web platforms, Android and iOS apps, AI software and fintech products — designed, built and shipped.',
    points: ['Web platforms', 'Mobile apps', 'AI software', 'Fintech'],
    href: '/services#build',
  },
  {
    icon: CandlestickChart,
    title: 'Trading systems',
    body: 'Broker platforms, algorithmic strategies, Pine Script indicators, MT5 expert advisors and copy trading.',
    points: ['Broker platforms', 'Algo trading', 'Pine Script', 'MT5 EAs'],
    href: '/services#trading',
  },
  {
    icon: Bot,
    title: 'Vision AI',
    body: 'Support chat agents, AI calling agents, business automation, and image and video generation.',
    points: ['Chat agents', 'Calling agents', 'Automation', 'Media generation'],
    href: '/services#ai',
  },
  {
    icon: Server,
    title: 'Hosting & infrastructure',
    body: 'AMD EPYC servers with NVMe storage, set up, secured and managed. Linux and Windows.',
    points: ['VPS hosting', 'Windows hosting', 'Managed setup', 'Free backups'],
    href: '/services#hosting',
  },
  {
    icon: MessageSquareText,
    title: 'Bulk SMS',
    body: 'Transactional and promotional SMS across India. Rates improve with volume, and no DLT registration to get through first.',
    points: ['No DLT registration', 'Volume pricing', 'Long validity'],
    href: '/services#messaging',
  },
  {
    icon: TrendingUp,
    title: 'Growth',
    body: 'Social media, digital marketing, SEO and lead generation — for after the product is live.',
    points: ['SEO', 'Digital marketing', 'Social media', 'Lead generation'],
    href: '/services#growth',
  },
];

const PROMISES = [
  {
    icon: ShieldCheck,
    title: 'You can see everything',
    body: 'Every client gets a portal: progress, invoices, testing, deliveries and files, in one place. No status-update emails.',
  },
  {
    icon: Zap,
    title: 'We stay after handover',
    body: 'Projects ship with a year of technical support, and the countdown runs where you can see it.',
  },
  {
    icon: Check,
    title: 'Priced before we start',
    body: 'A quote you approve, milestones you sign off, and an invoice that matches what was agreed.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Decorative only, and marked so screen readers skip it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[500px] bg-[radial-gradient(60%_60%_at_50%_40%,var(--color-primary)/0.14,transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              Taking on new projects
            </span>

            <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Software, infrastructure and AI,{' '}
              <span className="text-primary">built to last.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              We design and build web platforms, mobile apps, trading systems and AI products —
              then host them, support them and keep them running.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Create an account
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/work">See our work</Link>
              </Button>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Free to sign up · Browse everything we have built · {SITE.responseTime}
            </p>
          </div>
        </div>
      </section>

      {/* ── Recent work ───────────────────────────────────────────────────── */}
      <WorkStrip />

      {/* ── Capabilities ──────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What we do</h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              Six things, properly. Not a list of everything a search engine might ask for.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary-muted text-primary">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {item.points.map((point) => (
                    <li
                      key={point}
                      className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Learn more
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How we work ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                How working with us actually goes
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                Most of the frustration in software projects comes from not knowing where things
                stand. So we built the platform you would be asking for updates through, and gave
                you a login to it on day one.
              </p>
              <Button asChild className="mt-7">
                <Link href="/contact">
                  Talk to us
                  <ArrowRight />
                </Link>
              </Button>
            </div>

            <div className="space-y-4">
              {PROMISES.map((promise) => (
                <div
                  key={promise.title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-muted text-success">
                    <promise.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{promise.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {promise.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing call to action ────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Tell us what you are building
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Create an account and you can browse everything we have delivered, price up a service,
            and message us directly — before you commit to anything.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Create an account
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Send us a message</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
