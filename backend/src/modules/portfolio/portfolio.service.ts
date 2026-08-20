import { Prisma, ProjectCategory, UserType } from '@prisma/client';
import prisma from '@config/database';
import { ApiError } from '@utils/api-error';
import type { CreatePortfolioDto, ListPortfolioDto, UpdatePortfolioDto } from './portfolio.validation';

/**
 * What a visitor or a lead is allowed to see.
 *
 * The omissions are the point. `sourceProjectId` links back to a real client
 * project and `ownerId` identifies the workspace; neither belongs in a public
 * response, and selecting explicitly means a column added later cannot leak by
 * default.
 */
const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  summary: true,
  category: true,
  industry: true,
  liveUrl: true,
  coverImage: true,
  gallery: true,
  techStack: true,
  highlights: true,
  deliveredAt: true,
  clientLabel: true,
  testimonial: true,
  isFeatured: true,
  sortOrder: true,
} satisfies Prisma.PortfolioItemSelect;

/** The studio sees everything, including the link back to the project. */
const ADMIN_SELECT = {
  ...PUBLIC_SELECT,
  isPublished: true,
  viewCount: true,
  sourceProjectId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PortfolioItemSelect;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';

/** Appends -2, -3 … until the slug is free within the workspace. */
const uniqueSlug = async (ownerId: string, base: string, ignoreId?: string): Promise<string> => {
  const root = slugify(base);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const clash = await prisma.portfolioItem.findFirst({
      where: { ownerId, slug: candidate, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw ApiError.badRequest('Could not derive a unique link for this title. Try a different one.');
};

/**
 * The one workspace whose published work is shown on the website.
 *
 * The public site has no session, so it cannot scope by the caller. It scopes
 * by the owner instead — the same account leads are attached to at sign-up.
 */
const publicOwnerId = async (): Promise<string | null> => {
  const owner = await prisma.user.findFirst({
    where: { userType: UserType.INTERNAL, role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return owner?.id ?? null;
};

export const PortfolioService = {
  /**
   * Published work, grouped by category.
   *
   * Grouping happens here rather than in the browser so the public page and
   * the lead catalog cannot drift apart — they render the same payload.
   */
  async publicCatalog(category?: ProjectCategory) {
    const ownerId = await publicOwnerId();
    if (!ownerId) return { items: [], categories: [], total: 0 };

    const items = await prisma.portfolioItem.findMany({
      where: { ownerId, isPublished: true, ...(category ? { category } : {}) },
      select: PUBLIC_SELECT,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { deliveredAt: 'desc' }],
    });

    // Counts come from the unfiltered set: a category tab that vanishes the
    // moment you select another one is worse than useless.
    const counts = await prisma.portfolioItem.groupBy({
      by: ['category'],
      where: { ownerId, isPublished: true },
      _count: true,
    });

    return {
      items,
      total: items.length,
      categories: counts
        .map((row) => ({ category: row.category, count: row._count }))
        .sort((a, b) => b.count - a.count),
    };
  },

  async publicItem(slug: string) {
    const ownerId = await publicOwnerId();
    if (!ownerId) throw ApiError.notFound('Not found');

    const item = await prisma.portfolioItem.findFirst({
      where: { ownerId, slug, isPublished: true },
      select: PUBLIC_SELECT,
    });
    if (!item) throw ApiError.notFound('That piece of work is not available');

    // Best-effort: a failed counter must never break the page.
    void prisma.portfolioItem
      .updateMany({ where: { ownerId, slug }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    return item;
  },

  async list(ownerId: string, query: ListPortfolioDto) {
    const where: Prisma.PortfolioItemWhereInput = {
      ownerId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.published !== undefined ? { isPublished: query.published } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { tagline: { contains: query.search, mode: 'insensitive' } },
              { industry: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const items = await prisma.portfolioItem.findMany({
      where,
      select: ADMIN_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return { items, total: items.length };
  },

  async getById(ownerId: string, id: string) {
    const item = await prisma.portfolioItem.findFirst({
      where: { id, ownerId },
      select: ADMIN_SELECT,
    });
    if (!item) throw ApiError.notFound('Portfolio item not found');
    return item;
  },

  async create(ownerId: string, input: CreatePortfolioDto) {
    const slug = await uniqueSlug(ownerId, input.slug || input.title);

    return prisma.portfolioItem.create({
      data: {
        ownerId,
        slug,
        title: input.title.trim(),
        tagline: input.tagline.trim(),
        summary: input.summary.trim(),
        category: input.category,
        industry: input.industry?.trim() || null,
        liveUrl: input.liveUrl?.trim() || null,
        coverImage: input.coverImage?.trim() || null,
        gallery: input.gallery ?? [],
        techStack: input.techStack ?? [],
        highlights: input.highlights ?? [],
        deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
        clientLabel: input.clientLabel?.trim() || null,
        testimonial: input.testimonial?.trim() || null,
        isPublished: input.isPublished ?? false,
        isFeatured: input.isFeatured ?? false,
        sortOrder: input.sortOrder ?? 0,
        sourceProjectId: input.sourceProjectId ?? null,
      },
      select: ADMIN_SELECT,
    });
  },

  async update(ownerId: string, id: string, input: UpdatePortfolioDto) {
    const existing = await prisma.portfolioItem.findFirst({
      where: { id, ownerId },
      select: { id: true, slug: true, title: true },
    });
    if (!existing) throw ApiError.notFound('Portfolio item not found');

    // Only re-derive the slug when asked. Changing a published URL silently
    // breaks every link anyone has shared.
    const slug =
      input.slug && input.slug !== existing.slug
        ? await uniqueSlug(ownerId, input.slug, id)
        : undefined;

    return prisma.portfolioItem.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline.trim() } : {}),
        ...(input.summary !== undefined ? { summary: input.summary.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.industry !== undefined ? { industry: input.industry?.trim() || null } : {}),
        ...(input.liveUrl !== undefined ? { liveUrl: input.liveUrl?.trim() || null } : {}),
        ...(input.coverImage !== undefined ? { coverImage: input.coverImage?.trim() || null } : {}),
        ...(input.gallery !== undefined ? { gallery: input.gallery } : {}),
        ...(input.techStack !== undefined ? { techStack: input.techStack } : {}),
        ...(input.highlights !== undefined ? { highlights: input.highlights } : {}),
        ...(input.deliveredAt !== undefined
          ? { deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null }
          : {}),
        ...(input.clientLabel !== undefined
          ? { clientLabel: input.clientLabel?.trim() || null }
          : {}),
        ...(input.testimonial !== undefined
          ? { testimonial: input.testimonial?.trim() || null }
          : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      select: ADMIN_SELECT,
    });
  },

  async remove(ownerId: string, id: string) {
    const result = await prisma.portfolioItem.deleteMany({ where: { id, ownerId } });
    if (!result.count) throw ApiError.notFound('Portfolio item not found');
    return { id };
  },

  /**
   * Pre-fill a portfolio entry from a real project.
   *
   * Returns a draft rather than saving one: the copy that goes public should be
   * read by a person first, and the client's name is deliberately left out of
   * what is carried across.
   */
  async draftFromProject(ownerId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: ownerId },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        liveUrl: true,
        coverImageUrl: true,
        galleryUrls: true,
        endDate: true,
        technologies: { select: { technology: { select: { name: true } } } },
      },
    });
    if (!project) throw ApiError.notFound('Project not found');

    return {
      sourceProjectId: project.id,
      title: project.title,
      slug: slugify(project.title),
      tagline: '',
      summary: project.description ?? '',
      category: project.category,
      liveUrl: project.liveUrl ?? null,
      coverImage: project.coverImageUrl ?? null,
      gallery: project.galleryUrls ?? [],
      techStack: project.technologies.map((row) => row.technology.name),
      deliveredAt: project.endDate ?? null,
      // Never carried across. Naming a client is a decision, not a default.
      clientLabel: null,
    };
  },
};
