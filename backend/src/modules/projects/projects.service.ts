import { ProjectStatus, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { resolvePagination } from '@utils/pagination.util';
import { uniqueSlug } from '@utils/slug.util';
import { toNumber } from '@utils/money.util';
import { ClientsModel } from '@modules/clients/clients.model';
import { ProjectsModel } from './projects.model';
import { recordActivity } from '@modules/portal/portal.activity';
import { NotificationService } from '@modules/notifications/notification.service';
import type {
  CreateProjectDto,
  ListProjectsDto,
  MilestoneDto,
  UpdateProjectDto,
} from './projects.validation';

const SORTABLE = ['createdAt', 'updatedAt', 'title', 'startDate', 'endDate', 'sortOrder', 'contractValue'];

/**
 * Builds a human-facing project code like `ECH-2026-001`.
 *
 * The prefix comes from the title's initials so it is recognisable on a
 * handover certificate; the sequence is per-prefix-per-year, and a collision
 * simply advances the counter rather than failing the create.
 */
const generateProjectCode = async (userId: string, title: string): Promise<string> => {
  const words = title
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const prefix = (
    words.length >= 2
      ? words.slice(0, 3).map((w) => w[0]).join('')
      : (words[0] ?? 'PRJ').slice(0, 3)
  )
    .toUpperCase()
    .padEnd(3, 'X')
    .slice(0, 4);

  const year = new Date().getFullYear();

  const last = await prisma.project.findFirst({
    where: { userId, code: { startsWith: `${prefix}-${year}-` } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let sequence = last?.code ? Number(last.code.split('-')[2] ?? 0) + 1 : 1;

  // The unique index is (userId, code); walk forward if the slot is taken.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = `${prefix}-${year}-${String(sequence).padStart(3, '0')}`;
    const clash = await prisma.project.count({ where: { userId, code: candidate } });
    if (!clash) return candidate;
    sequence += 1;
  }

  return `${prefix}-${year}-${Date.now().toString().slice(-4)}`;
};

const blankToNull = <T extends Record<string, unknown>>(input: T): T => {
  const output = { ...input };
  for (const key of Object.keys(output)) {
    if (output[key] === '') (output as Record<string, unknown>)[key] = null;
  }
  return output;
};

/** Client-facing wording for a project status — never the raw enum. */
const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  [ProjectStatus.LEAD]: 'Lead',
  [ProjectStatus.PLANNING]: 'Planning',
  [ProjectStatus.IN_PROGRESS]: 'In progress',
  [ProjectStatus.ON_HOLD]: 'On hold',
  [ProjectStatus.COMPLETED]: 'Completed',
  [ProjectStatus.MAINTENANCE]: 'Maintenance',
  [ProjectStatus.CANCELLED]: 'Cancelled',
};

export const ProjectsService = {
  async list(userId: string, query: ListProjectsDto) {
    const pagination = resolvePagination(query, {
      allowedSortFields: SORTABLE,
      defaultSortBy: 'createdAt',
      defaultLimit: 12,
    });
    const where = ProjectsModel.buildWhere(userId, query);

    const [items, total] = await Promise.all([
      ProjectsModel.findMany(where, {
        skip: pagination.skip,
        take: pagination.take,
        orderBy: pagination.orderBy,
      }),
      ProjectsModel.count(where),
    ]);

    // Flatten the join table so the client gets `technologies: Technology[]`.
    const flattened = items.map(({ technologies, ...project }) => ({
      ...project,
      technologies: technologies.map((t) => t.technology),
    }));

    return { items: flattened, total, page: pagination.page, limit: pagination.limit };
  },

  async getById(userId: string, id: string) {
    const project = await ProjectsModel.findById(userId, id);
    if (!project) throw ApiError.notFound('Project');

    const invoiced = project.invoices.reduce((sum, inv) => sum + toNumber(inv.total), 0);
    const outstanding = project.invoices.reduce((sum, inv) => sum + toNumber(inv.balanceDue), 0);

    return {
      ...project,
      technologies: project.technologies.map((t) => t.technology),
      // Named `metrics`, not `summary` — the project already has a text
      // `summary` field, and spreading both under one key drops the text.
      metrics: {
        totalInvoiced: invoiced,
        totalCollected: invoiced - outstanding,
        outstanding,
        contractValue: toNumber(project.contractValue),
        loggedHours: toNumber(project.loggedHours),
        milestonesTotal: project.milestones.length,
        milestonesCompleted: project.milestones.filter((m) => m.completedAt !== null).length,
      },
    };
  },

  async getPublicBySlug(userId: string, slug: string) {
    const project = await ProjectsModel.findPublicBySlug(userId, slug);
    if (!project) throw ApiError.notFound('Project');
    return { ...project, technologies: project.technologies.map((t) => t.technology) };
  },

  async create(userId: string, dto: CreateProjectDto) {
    const { technologies, clientId, ...rest } = blankToNull(dto);

    if (clientId && !(await ClientsModel.exists(userId, clientId))) {
      throw ApiError.badRequest('The selected client does not exist');
    }

    const slug = await uniqueSlug(rest.title, (candidate) =>
      ProjectsModel.slugExists(userId, candidate),
    );

    const data: Prisma.ProjectCreateInput = {
      ...rest,
      slug,
      code: rest.code || (await generateProjectCode(userId, rest.title)),
      user: { connect: { id: userId } },
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
    };

    const project = await ProjectsModel.create(data);

    await recordActivity({
      projectId: project.id,
      actorId: userId,
      action: 'project.created',
      entityType: 'Project',
      entityId: project.id,
      summary: `Project "${project.title}" created`,
    });

    if (technologies?.length) {
      const ids = await ProjectsModel.resolveTechnologies(technologies);
      await ProjectsModel.setTechnologies(project.id, ids);
    }

    return this.getById(userId, project.id);
  },

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    if (!(await ProjectsModel.exists(userId, id))) throw ApiError.notFound('Project');

    const { technologies, clientId, title, ...rest } = blankToNull(dto);

    if (clientId && !(await ClientsModel.exists(userId, clientId))) {
      throw ApiError.badRequest('The selected client does not exist');
    }

    const data: Prisma.ProjectUpdateInput = { ...rest };

    // Renaming regenerates the slug, keeping portfolio URLs meaningful.
    if (title) {
      data.title = title;
      data.slug = await uniqueSlug(title, (candidate) =>
        ProjectsModel.slugExists(userId, candidate, id),
      );
    }

    if (clientId === null) data.client = { disconnect: true };
    else if (clientId) data.client = { connect: { id: clientId } };

    const before = rest.status
      ? await prisma.project.findUnique({ where: { id }, select: { status: true, title: true, code: true } })
      : null;

    await ProjectsModel.update(userId, id, data);

    if (technologies) {
      const ids = await ProjectsModel.resolveTechnologies(technologies);
      await ProjectsModel.setTechnologies(id, ids);
    }

    // Clients watch for exactly this. Only announced on an actual change —
    // re-saving a form with the same status should not mail anyone.
    if (before && rest.status && before.status !== rest.status) {
      NotificationService.emitAsync({
        event: 'project.status_changed',
        audience: { projectId: id, include: ['client'] },
        context: {
          projectName: before.title,
          projectCode: before.code ?? undefined,
          status: PROJECT_STATUS_LABELS[rest.status] ?? rest.status,
        },
        projectId: id,
        link: `/portal/projects/${id}`,
      });
    }

    return this.getById(userId, id);
  },

  async remove(userId: string, id: string) {
    if (!(await ProjectsModel.exists(userId, id))) throw ApiError.notFound('Project');
    await ProjectsModel.softDelete(userId, id);
  },

  async logHours(userId: string, id: string, hours: number) {
    if (!(await ProjectsModel.exists(userId, id))) throw ApiError.notFound('Project');
    return ProjectsModel.incrementHours(userId, id, hours);
  },

  reorder: (userId: string, items: { id: string; sortOrder: number }[]) =>
    ProjectsModel.reorder(userId, items),

  async addMilestone(userId: string, projectId: string, dto: MilestoneDto) {
    if (!(await ProjectsModel.exists(userId, projectId))) throw ApiError.notFound('Project');
    return ProjectsModel.addMilestone(projectId, dto);
  },

  async updateMilestone(userId: string, projectId: string, milestoneId: string, dto: Partial<MilestoneDto> & { completed?: boolean }) {
    if (!(await ProjectsModel.exists(userId, projectId))) throw ApiError.notFound('Project');
    const { completed, ...rest } = dto;
    const data: Prisma.ProjectMilestoneUpdateInput = { ...rest };
    if (completed !== undefined) data.completedAt = completed ? new Date() : null;
    return ProjectsModel.updateMilestone(projectId, milestoneId, data);
  },

  async removeMilestone(userId: string, projectId: string, milestoneId: string) {
    if (!(await ProjectsModel.exists(userId, projectId))) throw ApiError.notFound('Project');
    await ProjectsModel.deleteMilestone(projectId, milestoneId);
  },

  listTechnologies: () => ProjectsModel.listTechnologies(),

  async stats(userId: string) {
    const [byCategory, byStatus, totals] = await Promise.all([
      ProjectsModel.categoryCounts(userId),
      ProjectsModel.statusCounts(userId),
      ProjectsModel.valueAggregate(userId),
    ]);

    return {
      total: totals._count._all,
      totalContractValue: toNumber(totals._sum.contractValue),
      totalLoggedHours: toNumber(totals._sum.loggedHours),
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    };
  },
};

export default ProjectsService;
