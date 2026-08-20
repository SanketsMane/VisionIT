import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { toSlug } from '@utils/slug.util';
import type { ListProjectsDto } from './projects.validation';

const scope = (userId: string): Prisma.ProjectWhereInput => ({ userId, deletedAt: null });

/** Catalog card projection — deliberately excludes long-form case study text. */
export const projectCardSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  status: true,
  visibility: true,
  coverImageUrl: true,
  liveUrl: true,
  repoUrl: true,
  playStoreUrl: true,
  appStoreUrl: true,
  featured: true,
  sortOrder: true,
  tags: true,
  currency: true,
  contractValue: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  client: { select: { id: true, name: true, companyName: true, avatarUrl: true } },
  technologies: { select: { technology: { select: { id: true, name: true, slug: true, color: true, iconUrl: true } } } },
  _count: { select: { milestones: true, invoices: true } },
} satisfies Prisma.ProjectSelect;

export const ProjectsModel = {
  buildWhere(userId: string, query: ListProjectsDto): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = scope(userId);
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.visibility) where.visibility = query.visibility;
    if (query.clientId) where.clientId = query.clientId;
    if (query.featured !== undefined) where.featured = query.featured;
    if (query.tag) where.tags = { has: query.tag };
    if (query.technology) {
      where.technologies = { some: { technology: { slug: toSlug(query.technology) } } };
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { summary: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.ProjectWhereInput, args: { skip: number; take: number; orderBy: Prisma.ProjectOrderByWithRelationInput }) =>
    prisma.project.findMany({ where, ...args, select: projectCardSelect }),

  count: (where: Prisma.ProjectWhereInput) => prisma.project.count({ where }),

  findById: (userId: string, id: string) =>
    prisma.project.findFirst({
      where: { id, ...scope(userId) },
      include: {
        client: { select: { id: true, name: true, companyName: true, email: true, avatarUrl: true, currency: true } },
        technologies: { include: { technology: true } },
        milestones: { orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] },
        invoices: {
          where: { deletedAt: null },
          select: { id: true, number: true, status: true, total: true, balanceDue: true, currency: true, issueDate: true, dueDate: true },
          orderBy: { issueDate: 'desc' },
        },
        _count: { select: { expenses: true } },
      },
    }),

  /** Public portfolio lookup — never scoped to a user, so it filters on visibility. */
  findPublicBySlug: (userId: string, slug: string) =>
    prisma.project.findFirst({
      where: { userId, slug, deletedAt: null, visibility: { in: ['PUBLIC', 'UNLISTED'] } },
      include: {
        technologies: { include: { technology: true } },
        client: { select: { name: true, companyName: true } },
      },
    }),

  slugExists: async (userId: string, slug: string, exceptId?: string): Promise<boolean> =>
    (await prisma.project.count({
      where: { userId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    })) > 0,

  exists: async (userId: string, id: string): Promise<boolean> =>
    (await prisma.project.count({ where: { id, ...scope(userId) } })) > 0,

  create: (data: Prisma.ProjectCreateInput) => prisma.project.create({ data }),

  update: (userId: string, id: string, data: Prisma.ProjectUpdateInput) =>
    prisma.project.update({ where: { id, userId }, data }),

  softDelete: (userId: string, id: string) =>
    prisma.project.update({ where: { id, userId }, data: { deletedAt: new Date() } }),

  incrementHours: (userId: string, id: string, hours: number) =>
    prisma.project.update({
      where: { id, userId },
      data: { loggedHours: { increment: hours } },
    }),

  reorder: (userId: string, items: { id: string; sortOrder: number }[]) =>
    prisma.$transaction(
      items.map((item) =>
        prisma.project.update({ where: { id: item.id, userId }, data: { sortOrder: item.sortOrder } }),
      ),
    ),

  // ---- Technologies (global dictionary, shared across users) --------------

  /**
   * Upserts each technology name into the shared dictionary and returns ids.
   * Names are matched on their slug so "Next.js", "next js" and "NextJS"
   * collapse into one canonical entry.
   */
  async resolveTechnologies(names: string[]): Promise<string[]> {
    const unique = [...new Map(names.map((n) => [toSlug(n), n.trim()])).entries()];
    const ids: string[] = [];
    for (const [slug, name] of unique) {
      if (!slug) continue;
      const tech = await prisma.technology.upsert({
        where: { slug },
        update: {},
        create: { slug, name },
        select: { id: true },
      });
      ids.push(tech.id);
    }
    return ids;
  },

  setTechnologies: async (projectId: string, technologyIds: string[]) => {
    await prisma.projectTechnology.deleteMany({ where: { projectId } });
    if (technologyIds.length) {
      await prisma.projectTechnology.createMany({
        data: technologyIds.map((technologyId) => ({ projectId, technologyId })),
        skipDuplicates: true,
      });
    }
  },

  listTechnologies: () =>
    prisma.technology.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { projects: true } } },
    }),

  // ---- Milestones ---------------------------------------------------------

  addMilestone: (projectId: string, data: Omit<Prisma.ProjectMilestoneCreateInput, 'project'>) =>
    prisma.projectMilestone.create({ data: { ...data, project: { connect: { id: projectId } } } }),

  updateMilestone: (projectId: string, milestoneId: string, data: Prisma.ProjectMilestoneUpdateInput) =>
    prisma.projectMilestone.update({ where: { id: milestoneId, projectId }, data }),

  deleteMilestone: (projectId: string, milestoneId: string) =>
    prisma.projectMilestone.delete({ where: { id: milestoneId, projectId } }),

  // ---- Aggregates ---------------------------------------------------------

  categoryCounts: (userId: string) =>
    prisma.project.groupBy({ by: ['category'], where: scope(userId), _count: { _all: true } }),

  statusCounts: (userId: string) =>
    prisma.project.groupBy({ by: ['status'], where: scope(userId), _count: { _all: true } }),

  valueAggregate: (userId: string) =>
    prisma.project.aggregate({
      where: scope(userId),
      _sum: { contractValue: true, loggedHours: true },
      _count: { _all: true },
    }),
};

export default ProjectsModel;
