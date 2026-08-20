import Link from 'next/link';
import { ArrowRight, Bug, FileText, FolderOpen, MessageSquare, PackageCheck, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from './reveal';
import { DARK_OUTLINE_BUTTON } from './section';

/**
 * The differentiator, given its own dark band.
 *
 * This is the one thing that is genuinely hard for a competitor to answer, so
 * it gets contrast and space rather than a bullet in a feature list.
 */
const FEATURES = [
  { icon: FolderOpen, label: 'Live progress', body: 'Milestones and delivery status, updated as work lands.' },
  { icon: Bug, label: 'Raise issues', body: 'Report a bug and watch it move to fixed.' },
  { icon: FileText, label: 'Invoices', body: 'Every invoice and payment, downloadable as PDF.' },
  { icon: PackageCheck, label: 'Deliveries', body: 'Builds and releases, with what changed in each.' },
  { icon: MessageSquare, label: 'Direct chat', body: 'Message us with files and screenshots. No ticket queue.' },
  { icon: Timer, label: 'Support clock', body: 'Exactly how much of your support year is left.' },
];

export function PortalPitch() {
  return (
    <div className="grid items-center gap-14 lg:grid-cols-2">
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Included, not extra
        </span>
        <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Every client gets the same platform we run the studio on
        </h2>
        <p className="mt-5 text-pretty leading-relaxed text-white/60">
          Most of the friction in software projects comes from not knowing where things stand. So
          we stopped writing status emails and gave clients the actual system instead — the one
          holding the milestones, the issues, the invoices and the files.
        </p>
        <p className="mt-4 text-pretty leading-relaxed text-white/60">
          It is not a report generated for you. It is where the work happens.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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
            <Link href="/contact">Talk to us first</Link>
          </Button>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.label} delay={index * 60}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <feature.icon className="size-4.5" />
              </span>
              <p className="mt-3.5 text-sm font-semibold text-white">{feature.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{feature.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
