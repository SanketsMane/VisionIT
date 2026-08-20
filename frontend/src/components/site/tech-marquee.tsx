import { Reveal } from './reveal';

/**
 * The stack, scrolling.
 *
 * Deliberately not a client-logo wall: the studio has three shipped products
 * and borrowing recognisable logos it has no relationship with would be a lie
 * the first phone call exposes. The tools are real, verifiable, and say
 * something a prospect actually cares about.
 */
const STACK = [
  'Next.js', 'React', 'React Native', 'Node.js', 'TypeScript', 'PostgreSQL',
  'Prisma', 'Python', 'OpenAI', 'AWS', 'Docker', 'Nginx', 'Redis', 'Firebase',
  'Flutter', 'MongoDB', 'Kotlin', 'Swift',
];

export function TechMarquee() {
  return (
    <section className="border-b border-border bg-background py-10">
      <Reveal>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          The stack we build on
        </p>
      </Reveal>

      {/* Faded at both edges so the strip reads as continuous motion rather
          than items appearing and vanishing at a hard boundary. */}
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]">
        <div className="flex w-max animate-[marquee_38s_linear_infinite] gap-3 motion-reduce:animate-none">
          {/* Rendered twice: the second copy is what the first scrolls into,
              which is what makes the loop seamless. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-3" aria-hidden={copy === 1}>
              {STACK.map((tool) => (
                <span
                  key={`${copy}-${tool}`}
                  className="whitespace-nowrap rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-soft"
                >
                  {tool}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
