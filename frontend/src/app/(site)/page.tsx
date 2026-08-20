import type { Metadata } from 'next';
import { Hero } from '@/components/site/hero';
import { TechMarquee } from '@/components/site/tech-marquee';
import { StatsBand } from '@/components/site/stats-band';
import { Capabilities } from '@/components/site/capabilities';
import { WorkShowcase } from '@/components/site/work-showcase';
import { Process } from '@/components/site/process';
import { PortalPitch } from '@/components/site/portal-pitch';
import { Faq } from '@/components/site/faq';
import { CtaBand } from '@/components/site/cta-band';
import { Section } from '@/components/site/section';
import { SITE } from '@/lib/site.config';

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
};

/**
 * The homepage.
 *
 * Ordered as an argument rather than a feature list: what we build, proof we
 * have built it, how the work runs, the thing nobody else offers, the
 * objections, then the ask. Sections alternate light, muted and dark so a long
 * page still has a rhythm to scroll through.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <TechMarquee />
      <StatsBand />

      <Section>
        <Capabilities />
      </Section>

      <Section tone="muted">
        <WorkShowcase />
      </Section>

      <Section>
        <Process />
      </Section>

      <Section tone="dark">
        <PortalPitch />
      </Section>

      <Section tone="muted">
        <Faq />
      </Section>

      <Section className="pb-24">
        <CtaBand />
      </Section>
    </>
  );
}
