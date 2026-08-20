import { PrismaClient, ProjectCategory } from '@prisma/client';

/**
 * Seeds the public work catalog from the studio's real projects.
 *
 * Two rules, both deliberate:
 *
 *   1. **Nothing is invented.** Every field here is either read from the
 *      project row or is a fact already known about the engagement — the live
 *      domain, the kind of product, the year. Where a detail is not known the
 *      field is left empty rather than filled with plausible copy, because a
 *      portfolio that describes work that was never done is worse than a
 *      portfolio with gaps.
 *   2. **No client identity.** `clientLabel` and `testimonial` are never
 *      seeded. Naming a client is a decision the studio makes per project,
 *      after asking them.
 *
 * Re-running updates the seeded fields and leaves anything edited in the admin
 * UI alone — see `PRESERVED` below.
 */

/**
 * Fields a person is expected to rewrite. Once an entry exists, the seed will
 * not touch these again, so a re-run never clobbers copy someone wrote.
 */
const PRESERVED = ['tagline', 'summary', 'highlights', 'clientLabel', 'testimonial'] as const;

interface KnownWork {
  /** Matched case-insensitively against the project title. */
  match: RegExp;
  category: ProjectCategory;
  industry: string;
  tagline: string;
  summary: string;
  techStack: string[];
  highlights: string[];
}

/**
 * What is actually known about each engagement. Kept short on purpose: a true
 * two-line description reads better than four invented paragraphs, and the
 * studio can expand it with the real story.
 */
const KNOWN: KnownWork[] = [
  {
    match: /refilify/i,
    category: ProjectCategory.CROSS_PLATFORM_APP,
    industry: 'Retail & fintech',
    tagline: 'A cashback and coupon app, built and shipped end to end.',
    summary:
      'Refilify lets shoppers find offers and earn cashback in one place. We built it from the ground up — the customer app, the coupon and offer management behind it, and the deployment that put it live.\n\nDelivered in milestones, each reviewed and signed off by the client in their own portal before we moved to the next.',
    techStack: [],
    highlights: [
      'Cashback and coupon engine',
      'Customer-facing mobile app',
      'Offer management for the operator',
      'Delivered in reviewed milestones',
    ],
  },
  {
    match: /truck\s*gee/i,
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Logistics & transport',
    tagline: 'A marketplace matching spare truck capacity to the loads that need it.',
    summary:
      'TruckGee connects operators with unused space in their trucks to the people who need freight moved — turning empty return journeys into paid ones.\n\nWe built and shipped the platform, set up the hosting it runs on, and stayed on for a year of technical support after handover.',
    techStack: [],
    highlights: [
      'Capacity and load matching',
      'Built and shipped end to end',
      'Hosting set up and managed',
      'One year of support included',
    ],
  },
  {
    match: /echo\s*soul/i,
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Counselling & wellbeing',
    tagline: 'A platform connecting people to counsellors and life coaches.',
    summary:
      'EchoSoul gives people a way to find and book counselling and life coaching, and gives practitioners somewhere to run that side of their work.\n\nWe designed, built and deployed it, handed it over complete, and kept a year of technical support attached.',
    techStack: [],
    highlights: [
      'Counsellor and coach discovery',
      'Designed, built and deployed',
      'One year of support included',
    ],
  },
];

const slugify = (value: string): string =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const seedPortfolio = async (
  prisma: PrismaClient,
  ownerId: string,
): Promise<{ created: number; updated: number; skipped: number }> => {
  const projects = await prisma.project.findMany({
    where: { userId: ownerId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      liveUrl: true,
      coverImageUrl: true,
      galleryUrls: true,
      startDate: true,
      endDate: true,
      status: true,
      technologies: { select: { technology: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [index, project] of projects.entries()) {
    const known = KNOWN.find((entry) => entry.match.test(project.title));
    const slug = slugify(project.title);
    if (!slug) {
      skipped += 1;
      continue;
    }

    const projectTech = project.technologies.map((row) => row.technology.name);
    const existing = await prisma.portfolioItem.findFirst({
      where: { ownerId, slug },
      select: { id: true },
    });

    // Facts, refreshed on every run. These come from the project row, so
    // keeping them in sync is the point.
    const facts = {
      title: project.title,
      category: known?.category ?? project.category,
      industry: known?.industry ?? null,
      liveUrl: project.liveUrl ?? null,
      coverImage: project.coverImageUrl ?? null,
      gallery: project.galleryUrls ?? [],
      techStack: projectTech.length ? projectTech : (known?.techStack ?? []),
      deliveredAt: project.endDate ?? null,
      sourceProjectId: project.id,
    };

    if (existing) {
      await prisma.portfolioItem.update({ where: { id: existing.id }, data: facts });
      updated += 1;
      continue;
    }

    await prisma.portfolioItem.create({
      data: {
        ownerId,
        slug,
        ...facts,
        tagline: known?.tagline ?? '',
        summary: known?.summary ?? project.description ?? '',
        highlights: known?.highlights ?? [],
        // Published only when there is something to read. An entry with an
        // empty tagline on the public site looks broken.
        isPublished: Boolean(known?.tagline),
        isFeatured: index === 0,
        sortOrder: index,
        clientLabel: null,
        testimonial: null,
      },
    });
    created += 1;
  }

  return { created, updated, skipped };
};

export { PRESERVED };
