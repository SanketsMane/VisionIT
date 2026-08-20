import { Reveal } from './reveal';
import { TechLogo, resolveTech, type Tech } from './tech-logo';

/**
 * The stack, scrolling.
 *
 * Deliberately not a client-logo wall: the studio has a handful of shipped
 * products and borrowing recognisable logos it has no relationship with is a
 * lie the first phone call exposes. These tools are real, verifiable, and say
 * something a technical buyer actually cares about.
 */
const STACK: Tech[] = [
  { slug: 'nextdotjs' },
  { slug: 'react' },
  { slug: 'typescript' },
  { slug: 'nodedotjs' },
  { slug: 'python' },
  { slug: 'postgresql' },
  { slug: 'prisma' },
  { slug: 'mongodb' },
  { slug: 'redis' },
  { slug: 'graphql' },
  { slug: 'tailwindcss' },
  { slug: 'docker' },
  { slug: 'nginx' },
  { slug: 'linux' },
  { slug: 'flutter' },
  { slug: 'kotlin', label: 'Kotlin' },
  { slug: 'swift' },
  { slug: 'android' },
  { slug: 'firebase' },
  { slug: 'stripe' },
  { slug: 'socketdotio', label: 'Socket.IO' },
  { slug: 'git' },
];

// Filtered at module load: a slug the package does not carry would otherwise
// render an invisible gap in the middle of the strip.
const TOOLS = STACK.filter((tech) => resolveTech(tech) !== null);

export function TechMarquee() {
  return (
    <section className="border-b border-border bg-background py-12">
      <Reveal>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          The stack we build on
        </p>
      </Reveal>

      {/* Faded at both edges so the strip reads as continuous motion rather
          than items appearing and vanishing at a hard boundary. */}
      <div className="relative mt-7 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
        <div className="flex w-max animate-[marquee_45s_linear_infinite] gap-3 motion-reduce:animate-none">
          {/* Rendered twice: the second copy is what the first scrolls into,
              which is what makes the loop seamless. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-3" aria-hidden={copy === 1}>
              {TOOLS.map((tech) => {
                const resolved = resolveTech(tech)!;
                return (
                  <span
                    key={`${copy}-${tech.slug}`}
                    className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition-colors hover:border-primary/40"
                  >
                    <TechLogo
                      tech={tech}
                      className="size-5 shrink-0 opacity-90 transition-opacity group-hover:opacity-100"
                    />
                    <span className="text-sm font-medium text-foreground/80">{resolved.title}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
