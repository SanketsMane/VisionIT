import {
  BugPriority,
  BugSeverity,
  DocumentVisibility,
  PaymentRequestStatus,
  ProjectDeliveryStatus,
  ProjectStatus,
  UserType,
} from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { add, round2, subtract, toNumber } from '@utils/money.util';
import { daysBetween } from '@utils/date.util';
import { resolvePagination } from '@utils/pagination.util';
import { ActivityModel } from '@modules/portal/portal.activity';
import { permissionsFor, ROLE_LABELS } from '@modules/portal/portal.permissions';
import { toSummary } from '@modules/support/support.service';
import { OPEN_STATUSES } from '@modules/portal/bugs/bugs.lifecycle';
import { DELIVERY_STATUS_LABELS } from '@modules/portal/delivery/delivery.constants';
import { DeliveryService } from '@modules/portal/delivery/delivery.service';

export type ProjectHealth = 'ON_TRACK' | 'AT_RISK' | 'DELAYED';

/**
 * Derives a traffic-light health signal.
 *
 * Deliberately computed rather than stored: a status someone has to remember to
 * update is a status that is always stale. Overdue delivery dominates, then
 * blockers, then money.
 */
const computeHealth = (input: {
  endDate: Date | null;
  status: ProjectStatus;
  criticalBugs: number;
  overdueInvoiceCount: number;
  milestonesTotal: number;
  milestonesCompleted: number;
}): { health: ProjectHealth; reasons: string[] } => {
  const reasons: string[] = [];
  let health: ProjectHealth = 'ON_TRACK';

  const daysRemaining = input.endDate ? daysBetween(new Date(), input.endDate) : null;
  const isFinished =
    input.status === ProjectStatus.COMPLETED || input.status === ProjectStatus.CANCELLED;

  if (!isFinished && daysRemaining !== null && daysRemaining < 0) {
    health = 'DELAYED';
    reasons.push(`Delivery date passed ${Math.abs(daysRemaining)} day(s) ago`);
  }

  if (input.criticalBugs > 0) {
    health = health === 'DELAYED' ? 'DELAYED' : 'AT_RISK';
    reasons.push(`${input.criticalBugs} critical issue(s) open`);
  }

  if (input.overdueInvoiceCount > 0) {
    health = health === 'DELAYED' ? 'DELAYED' : 'AT_RISK';
    reasons.push(`${input.overdueInvoiceCount} overdue invoice(s)`);
  }

  // A deadline close at hand with most milestones outstanding is a warning
  // sign well before the date actually passes.
  if (
    !isFinished &&
    daysRemaining !== null &&
    daysRemaining >= 0 &&
    daysRemaining <= 14 &&
    input.milestonesTotal > 0 &&
    input.milestonesCompleted / input.milestonesTotal < 0.75
  ) {
    health = health === 'DELAYED' ? 'DELAYED' : 'AT_RISK';
    reasons.push('Delivery date is close with milestones outstanding');
  }

  if (health === 'ON_TRACK' && !reasons.length) reasons.push('No blockers');
  return { health, reasons };
};

export const WorkspaceService = {
  /**
   * The project command centre — one payload covering progress, money, QA and
   * delivery, so the workspace screen makes a single request instead of eight.
   */
  async overview(projectId: string, includeInternal: boolean) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, companyName: true, avatarUrl: true } },
        milestones: { orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }] },
        technologies: { include: { technology: true } },
      },
    });
    if (!project) throw ApiError.notFound('Project');

    const [
      invoiceAgg,
      overdueInvoices,
      bugCounts,
      criticalBugs,
      memberCount,
      documentCount,
      pendingRequests,
      delivery,
      support,
      announcements,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { projectId, deletedAt: null, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        _sum: { total: true, amountPaid: true, balanceDue: true },
        _count: { _all: true },
      }),
      prisma.invoice.count({
        where: {
          projectId,
          deletedAt: null,
          status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.bug.groupBy({ by: ['status'], where: { projectId }, _count: { _all: true } }),
      prisma.bug.count({
        where: {
          projectId,
          status: { in: OPEN_STATUSES },
          OR: [{ priority: BugPriority.CRITICAL }, { severity: BugSeverity.BLOCKER }],
        },
      }),
      prisma.projectMember.count({ where: { projectId, isActive: true } }),
      prisma.projectDocument.count({
        where: {
          projectId,
          ...(includeInternal ? {} : { visibility: DocumentVisibility.CLIENT_VISIBLE }),
        },
      }),
      prisma.paymentRequest.count({
        where: { projectId, status: PaymentRequestStatus.PENDING },
      }),
      prisma.projectDelivery.findUnique({
        where: { projectId },
        select: { status: true, version: true, clientConfirmedAt: true, adminConfirmedAt: true },
      }),
      prisma.projectSupport.findUnique({ where: { projectId } }),
      prisma.announcement.findMany({
        where: { projectId },
        select: {
          id: true, title: true, body: true, isPinned: true, publishedAt: true,
          publishedBy: { select: { name: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        take: 3,
      }),
    ]);

    const statusCounts = Object.fromEntries(bugCounts.map((r) => [r.status, r._count._all]));
    const openBugs = OPEN_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);

    const milestonesCompleted = project.milestones.filter((m) => m.completedAt !== null).length;
    const milestonesTotal = project.milestones.length;

    const invoiced = toNumber(invoiceAgg._sum.total);
    const paid = toNumber(invoiceAgg._sum.amountPaid);
    const pending = toNumber(invoiceAgg._sum.balanceDue);
    const contractValue = toNumber(project.contractValue);

    const { health, reasons } = computeHealth({
      endDate: project.endDate,
      status: project.status,
      criticalBugs,
      overdueInvoiceCount: overdueInvoices,
      milestonesTotal,
      milestonesCompleted,
    });

    // Milestone completion is the honest progress signal when milestones
    // exist; otherwise fall back to the project's lifecycle status.
    const progress = milestonesTotal
      ? Math.round((milestonesCompleted / milestonesTotal) * 100)
      : project.status === ProjectStatus.COMPLETED
        ? 100
        : project.status === ProjectStatus.IN_PROGRESS
          ? 50
          : project.status === ProjectStatus.PLANNING
            ? 10
            : 0;

    const currentMilestone =
      project.milestones.find((m) => !m.completedAt) ?? null;

    return {
      project: {
        id: project.id,
        title: project.title,
        code: project.code,
        summary: project.summary,
        description: project.description,
        status: project.status,
        category: project.category,
        logoUrl: project.logoUrl,
        currency: project.currency,
        startDate: project.startDate,
        endDate: project.endDate,
        deliveryDate: project.deliveryDate,
        client: project.client,
        technologies: project.technologies.map((t) => t.technology),
      },
      health: { status: health, reasons },
      progress: {
        percent: progress,
        milestonesTotal,
        milestonesCompleted,
        currentMilestone,
        daysRemaining: project.endDate ? daysBetween(new Date(), project.endDate) : null,
      },
      financial: {
        contractValue,
        invoiced,
        paid,
        pending,
        // What's been agreed but not yet billed.
        uninvoiced: round2(Math.max(0, subtract(contractValue, invoiced).toNumber())).toNumber(),
        invoiceCount: invoiceAgg._count._all,
        overdueInvoices,
        pendingPaymentRequests: pendingRequests,
        paidPercent: contractValue > 0 ? Math.round((paid / contractValue) * 100) : 0,
      },
      testing: {
        total: bugCounts.reduce((sum, r) => sum + r._count._all, 0),
        open: openBugs,
        critical: criticalBugs,
        byStatus: statusCounts,
      },
      delivery: {
        status: delivery?.status ?? ProjectDeliveryStatus.NOT_STARTED,
        statusLabel:
          DELIVERY_STATUS_LABELS[delivery?.status ?? ProjectDeliveryStatus.NOT_STARTED],
        version: delivery?.version ?? null,
        adminConfirmed: Boolean(delivery?.adminConfirmedAt),
        clientConfirmed: Boolean(delivery?.clientConfirmedAt),
      },
      // The client's countdown reads this. `includeInternal` keeps the
      // studio-only note out of the client's payload entirely.
      support: toSummary(support, includeInternal),
      milestones: project.milestones,
      counts: { members: memberCount, documents: documentCount },
      announcements,
    };
  },

  /**
   * The client's landing page: every project they can reach, with just enough
   * detail to choose one.
   */
  async clientDashboard(userId: string) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId, isActive: true, project: { deletedAt: null } },
      select: {
        role: true,
        project: {
          select: {
            id: true, title: true, code: true, summary: true, logoUrl: true,
            status: true, currency: true, contractValue: true, endDate: true,
            user: {
              select: { company: { select: { legalName: true, tradeName: true, logoUrl: true } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    if (!memberships.length) {
      return { projects: [], totals: { projects: 0, openBugs: 0, pending: 0 }, studio: null };
    }

    const projectIds = memberships.map((m) => m.project.id);

    const [invoiceAggs, bugAggs, deliveries, supportTerms] = await Promise.all([
      prisma.invoice.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
        },
        _sum: { total: true, amountPaid: true, balanceDue: true },
      }),
      prisma.bug.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, status: { in: OPEN_STATUSES } },
        _count: { _all: true },
      }),
      prisma.projectDelivery.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true, status: true, version: true },
      }),
      prisma.projectSupport.findMany({ where: { projectId: { in: projectIds } } }),
    ]);

    const invoiceByProject = new Map(invoiceAggs.map((a) => [a.projectId, a._sum]));
    const bugByProject = new Map(bugAggs.map((a) => [a.projectId, a._count._all]));
    const deliveryByProject = new Map(deliveries.map((d) => [d.projectId, d]));
    const supportByProject = new Map(supportTerms.map((t) => [t.projectId, t]));
    // One clock for the whole list, so two cards can't disagree by a tick.
    const now = new Date();

    const projects = memberships.map((membership) => {
      const project = membership.project;
      const invoices = invoiceByProject.get(project.id);
      const delivery = deliveryByProject.get(project.id);

      return {
        id: project.id,
        title: project.title,
        code: project.code,
        summary: project.summary,
        logoUrl: project.logoUrl,
        status: project.status,
        currency: project.currency,
        endDate: project.endDate,
        role: membership.role,
        roleLabel: ROLE_LABELS[membership.role],
        permissions: permissionsFor(membership.role),
        financial: {
          contractValue: toNumber(project.contractValue),
          invoiced: toNumber(invoices?.total),
          paid: toNumber(invoices?.amountPaid),
          pending: toNumber(invoices?.balanceDue),
        },
        openBugs: bugByProject.get(project.id) ?? 0,
        delivery: {
          status: delivery?.status ?? ProjectDeliveryStatus.NOT_STARTED,
          statusLabel: DELIVERY_STATUS_LABELS[delivery?.status ?? ProjectDeliveryStatus.NOT_STARTED],
          version: delivery?.version ?? null,
        },
        support: toSummary(supportByProject.get(project.id) ?? null, false, now),
      };
    });

    const studioCompany = memberships[0].project.user.company;

    return {
      projects,
      totals: {
        projects: projects.length,
        openBugs: projects.reduce((sum, p) => sum + p.openBugs, 0),
        pending: round2(add(...projects.map((p) => p.financial.pending))).toNumber(),
      },
      studio: studioCompany
        ? {
            name: studioCompany.tradeName ?? studioCompany.legalName,
            logoUrl: studioCompany.logoUrl,
          }
        : null,
    };
  },

  /** Invoices a client may see — drafts are the studio's business alone. */
  async projectInvoices(projectId: string, includeDrafts: boolean) {
    return prisma.invoice.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(includeDrafts ? {} : { status: { not: 'DRAFT' } }),
      },
      select: {
        id: true, number: true, documentType: true, status: true, currency: true,
        issueDate: true, dueDate: true, subtotal: true, taxAmount: true,
        total: true, amountPaid: true, balanceDue: true, publicToken: true,
        payments: {
          select: { id: true, amount: true, paidAt: true, method: true, reference: true },
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  },

  activity: (projectId: string, query: { page?: number; limit?: number }, includeInternal: boolean) => {
    const pagination = resolvePagination(query, { defaultLimit: 30 });
    return Promise.all([
      ActivityModel.list(projectId, {
        skip: pagination.skip,
        take: pagination.take,
        includeInternal,
      }),
      ActivityModel.count(projectId, includeInternal),
    ]).then(([items, total]) => ({
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
    }));
  },

  /** Admin roster of every client user across the workspace. */
  async workspaceClients(ownerId: string) {
    const users = await prisma.user.findMany({
      where: { ownerId, userType: UserType.CLIENT },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        isActive: true, lastLoginAt: true, createdAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            role: true,
            // clientId lets the Clients screen show which portal logins belong
            // to a given business without a second round trip.
            project: { select: { id: true, title: true, code: true, clientId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      ...user,
      memberships: user.memberships.map((m) => ({
        ...m,
        roleLabel: ROLE_LABELS[m.role],
      })),
    }));
  },

  /** Cross-project delivery board for the studio. */
  async deliveryBoard(ownerId: string) {
    const projects = await prisma.project.findMany({
      where: { userId: ownerId, deletedAt: null },
      select: {
        id: true, title: true, code: true, status: true, endDate: true,
        delivery: {
          select: {
            status: true, version: true, adminConfirmedAt: true,
            clientConfirmedAt: true, deliveredAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects
      .filter((project) => project.delivery)
      .map((project) => ({
        ...project,
        delivery: {
          ...project.delivery,
          statusLabel:
            DELIVERY_STATUS_LABELS[project.delivery?.status ?? ProjectDeliveryStatus.NOT_STARTED],
        },
      }));
  },

  ensureDelivery: (projectId: string) => DeliveryService.ensure(projectId),
};

export default WorkspaceService;
