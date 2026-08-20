import { Reveal } from './reveal';
import { SectionHeading } from './section';

/**
 * How an engagement actually runs, in the order it happens.
 *
 * Written as commitments rather than jargon: "we quote before we start" tells a
 * prospect something they can hold us to, "discovery phase" does not.
 */
const STEPS = [
  {
    n: '01',
    title: 'We talk, then we quote',
    body: 'A call to understand what you need and who it is for. You get a written scope and a fixed price before anyone writes code.',
  },
  {
    n: '02',
    title: 'You get a login on day one',
    body: 'Your project appears in your portal with its milestones. Progress, files, issues and invoices all live there from the start.',
  },
  {
    n: '03',
    title: 'Built in stages you sign off',
    body: 'Each milestone is delivered for review. You test it, raise issues in the portal, and approve it before we move on.',
  },
  {
    n: '04',
    title: 'Deployed and handed over',
    body: 'We put it live on infrastructure we set up and secure, with credentials handed to you and nothing left on our machines.',
  },
  {
    n: '05',
    title: 'Supported for a year',
    body: 'Twelve months of technical support, with the countdown running in your dashboard so you always know where you stand.',
  },
];

export function Process() {
  return (
    <>
      <SectionHeading
        eyebrow="How we work"
        title="No black boxes, no chasing for updates"
        description="The part most studios leave vague, written down."
        align="center"
      />

      <div className="relative mt-14">
        {/* The spine. Hidden below lg, where the steps stack and a vertical
            rule would run through the middle of the text. */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
        />

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={index * 80}>
              <li className="relative">
                <span className="relative z-10 grid size-14 place-items-center rounded-2xl border border-border bg-card text-sm font-bold text-primary shadow-soft">
                  {step.n}
                </span>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </>
  );
}
