'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Reveal } from './reveal';
import { SectionHeading } from './section';
import { cn } from '@/lib/utils';

/**
 * The questions that actually come up before a first call.
 *
 * Answered plainly, including the ones with an awkward answer — a prospect who
 * finds out about the payment terms here is better than one who finds out after
 * signing.
 */
const FAQS = [
  {
    q: 'How do you price a project?',
    a: 'Fixed price, agreed before we start. We scope the work from a first call, send a written quote, and break it into milestones. If the scope changes mid-project we re-quote the difference rather than absorbing it quietly or surprising you at the end.',
  },
  {
    q: 'How do payments work?',
    a: 'Milestone based. An advance to begin, then a payment as each milestone is delivered and approved. You upload proof of transfer in your portal and we confirm it against the invoice — every payment is receipted and visible in your account.',
  },
  {
    q: 'What happens after the project is delivered?',
    a: 'Twelve months of technical support is included, and the remaining time shows as a live countdown in your dashboard. If we host it for you, we keep it patched and monitored for as long as you stay with us.',
  },
  {
    q: 'Do I own the code?',
    a: 'Yes. On final payment the code, the repositories and the hosting credentials are handed over to you. Nothing stays locked to us, and nothing keeps working only while you keep paying.',
  },
  {
    q: 'Can you take over a project someone else started?',
    a: 'Often, yes. We will want to read the codebase first and be straight with you about what we find — sometimes continuing is the right call and sometimes rebuilding a part of it is cheaper than working around it. Either way you get that assessment before you commit.',
  },
  {
    q: 'How quickly can you start?',
    a: 'We reply to every enquiry within one working day and can usually scope a project within a week. Start dates depend on what is already in flight — we would rather tell you a real date than take the work and queue it silently.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <SectionHeading
        eyebrow="Questions"
        title="The things people ask before the first call"
        align="center"
      />

      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = open === index;
          return (
            <Reveal key={faq.q} delay={index * 40}>
              <div
                className={cn(
                  'overflow-hidden rounded-2xl border bg-card transition-colors',
                  isOpen ? 'border-primary/40' : 'border-border',
                )}
              >
                <h3>
                  <button
                    type="button"
                    // Toggles closed on a second click, so a reader can collapse
                    // an answer they have finished with.
                    onClick={() => setOpen(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  >
                    <span className="text-sm font-semibold sm:text-base">{faq.q}</span>
                    <span
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-lg transition-colors',
                        isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isOpen ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                    </span>
                  </button>
                </h3>
                {/* Grid-rows transition animates to the content's natural height
                    without measuring it in JavaScript. */}
                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out',
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
