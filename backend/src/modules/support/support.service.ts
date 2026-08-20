import type { ProjectSupport } from '@prisma/client';
import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { dayjs, formatDate } from '@utils/date.util';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';
import { SupportModel } from './support.model';
import {
  EXPIRING_SOON_DAYS,
  SUPPORT_PLAN_LABELS,
  SUPPORT_STATE_LABELS,
  type SupportState,
  type SupportSummary,
} from './support.types';
import type { CancelSupportDto, RenewSupportDto, UpsertSupportDto } from './support.validation';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The end of a term is the end of that day, not the midnight that starts it. */
const termEnd = (start: Date, months: number): Date =>
  dayjs.utc(start).add(months, 'month').endOf('day').toDate();

const planLabelFor = (support: Pick<ProjectSupport, 'plan' | 'planLabel'>): string =>
  support.planLabel?.trim() || SUPPORT_PLAN_LABELS[support.plan];

/**
 * Where a term stands right now.
 *
 * Cancellation is the only stored state; everything else falls out of the
 * clock, so this is the single place the rules live.
 */
export const resolveState = (support: ProjectSupport, now: Date = new Date()): SupportState => {
  if (support.isCancelled) return 'CANCELLED';
  if (now < support.startDate) return 'SCHEDULED';
  if (now > support.endDate) return 'EXPIRED';

  const daysLeft = (support.endDate.getTime() - now.getTime()) / MS_PER_DAY;
  return daysLeft <= EXPIRING_SOON_DAYS ? 'EXPIRING_SOON' : 'ACTIVE';
};

/**
 * Builds the payload the countdown renders from.
 *
 * `includeInternal` gates the studio-only note. It is derived from the route
 * the caller came in on, never from anything in the request body.
 */
export const toSummary = (
  support: ProjectSupport | null,
  includeInternal: boolean,
  now: Date = new Date(),
): SupportSummary => {
  if (!support) {
    return {
      state: 'NOT_CONFIGURED',
      stateLabel: SUPPORT_STATE_LABELS.NOT_CONFIGURED,
      planLabel: '',
      startDate: null,
      endDate: null,
      serverTime: now.toISOString(),
      daysRemaining: null,
      msRemaining: 0,
      totalDays: null,
      percentElapsed: 0,
      durationMonths: null,
      renewalCount: 0,
      inclusions: [],
      responseTime: null,
      supportEmail: null,
      supportPhone: null,
      ...(includeInternal ? { notes: null } : {}),
    };
  }

  const state = resolveState(support, now);
  const msRemaining = Math.max(0, support.endDate.getTime() - now.getTime());
  const totalMs = support.endDate.getTime() - support.startDate.getTime();
  const elapsedMs = now.getTime() - support.startDate.getTime();

  return {
    state,
    stateLabel: SUPPORT_STATE_LABELS[state],
    planLabel: planLabelFor(support),
    startDate: support.startDate.toISOString(),
    endDate: support.endDate.toISOString(),
    serverTime: now.toISOString(),
    // Floored, so "1 day remaining" means at least a full day is left.
    daysRemaining: Math.floor((support.endDate.getTime() - now.getTime()) / MS_PER_DAY),
    msRemaining: state === 'CANCELLED' ? 0 : msRemaining,
    totalDays: Math.round(totalMs / MS_PER_DAY),
    percentElapsed:
      totalMs <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))),
    durationMonths: support.durationMonths,
    renewalCount: support.renewalCount,
    inclusions: support.inclusions,
    responseTime: support.responseTime,
    supportEmail: support.supportEmail,
    supportPhone: support.supportPhone,
    ...(includeInternal ? { notes: support.notes } : {}),
  };
};

const notifyClients = (
  projectId: string,
  event: 'support.started' | 'support.renewed' | 'support.expiring' | 'support.expired',
  project: { title: string; code: string | null },
  support: ProjectSupport,
  extra: Record<string, string> = {},
): void => {
  NotificationService.emitAsync({
    event,
    audience: { projectId, include: ['client'] },
    context: {
      projectName: project.title,
      projectCode: project.code ?? undefined,
      title: planLabelFor(support),
      dueDate: formatDate(support.endDate),
      // The "what's included" list and the SLA are the substance of the
      // email — without them it just says support exists.
      body: support.inclusions.join('\n'),
      reason: support.responseTime ?? undefined,
      ...extra,
    },
    projectId,
    link: `/portal/projects/${projectId}`,
  });
};

export const SupportService = {
  async get(projectId: string, includeInternal: boolean): Promise<SupportSummary> {
    return toSummary(await SupportModel.findByProject(projectId), includeInternal);
  },

  /**
   * Creates or replaces the support term.
   *
   * Idempotent by design — the studio screen is a single form that is saved
   * repeatedly, not a create-then-edit flow, and an admin correcting a typo in
   * the start date should not end up with two terms.
   */
  async upsert(projectId: string, dto: UpsertSupportDto, actor: { id: string; name: string }) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, code: true },
    });
    if (!project) throw ApiError.notFound('Project');

    const existing = await SupportModel.findByProject(projectId);
    const endDate = termEnd(dto.startDate, dto.durationMonths);

    const fields = {
      plan: dto.plan,
      planLabel: dto.planLabel ?? null,
      startDate: dto.startDate,
      endDate,
      durationMonths: dto.durationMonths,
      inclusions: dto.inclusions,
      responseTime: dto.responseTime ?? null,
      supportEmail: dto.supportEmail ?? null,
      supportPhone: dto.supportPhone ?? null,
      notes: dto.notes ?? null,
      // Saving the form revives a cancelled term rather than leaving it in a
      // state the admin can't get out of.
      isCancelled: false,
      cancelledAt: null,
    };

    const support = await SupportModel.upsert(
      projectId,
      { ...fields, project: { connect: { id: projectId } } },
      {
        ...fields,
        // A changed end date means the old warnings no longer apply.
        ...(existing && existing.endDate.getTime() !== endDate.getTime()
          ? { remindersSent: [] }
          : {}),
      },
    );

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: existing ? 'support.updated' : 'support.started',
      entityType: 'ProjectSupport',
      entityId: support.id,
      summary: existing
        ? `${actor.name} updated the support term — now runs to ${formatDate(endDate)}`
        : `${actor.name} started ${planLabelFor(support)} until ${formatDate(endDate)}`,
    });

    // Only announce a genuinely new term. Editing a phone number should not
    // send the client a "your support has started" email.
    if (!existing) notifyClients(projectId, 'support.started', project, support);

    logger.info('Support term saved', { projectId, endDate, isNew: !existing });
    return toSummary(support, true);
  },

  /** Extends the term, continuing from the current end date unless told otherwise. */
  async renew(projectId: string, dto: RenewSupportDto, actor: { id: string; name: string }) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, code: true },
    });
    if (!project) throw ApiError.notFound('Project');

    const existing = await SupportModel.findByProject(projectId);
    if (!existing) throw ApiError.badRequest('Set up a support term before renewing it');

    // Continuing from the old end date is the default because it leaves no
    // uncovered gap; restarting from today is the explicit choice for a term
    // that already lapsed.
    const anchor = dto.restartFromToday ? dayjs.utc().startOf('day').toDate() : existing.endDate;
    const endDate = termEnd(anchor, dto.months);

    const support = await SupportModel.update(projectId, {
      startDate: dto.restartFromToday ? anchor : existing.startDate,
      endDate,
      durationMonths: existing.durationMonths + dto.months,
      renewalCount: { increment: 1 },
      isCancelled: false,
      cancelledAt: null,
      remindersSent: [],
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'support.renewed',
      entityType: 'ProjectSupport',
      entityId: support.id,
      summary: `${actor.name} renewed support for ${dto.months} more month(s), to ${formatDate(endDate)}`,
    });

    notifyClients(projectId, 'support.renewed', project, support, {
      count: String(dto.months),
    });

    logger.info('Support renewed', { projectId, months: dto.months, endDate });
    return toSummary(support, true);
  },

  async cancel(projectId: string, dto: CancelSupportDto, actor: { id: string; name: string }) {
    const existing = await SupportModel.findByProject(projectId);
    if (!existing) throw ApiError.notFound('Support term');

    const support = await SupportModel.update(projectId, {
      isCancelled: true,
      cancelledAt: new Date(),
      ...(dto.reason ? { notes: dto.reason } : {}),
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'support.cancelled',
      entityType: 'ProjectSupport',
      entityId: support.id,
      summary: `${actor.name} cancelled the support term`,
    });

    return toSummary(support, true);
  },

  async remove(projectId: string, actor: { id: string; name: string }) {
    const existing = await SupportModel.findByProject(projectId);
    if (!existing) throw ApiError.notFound('Support term');

    await SupportModel.remove(projectId);
    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'support.removed',
      entityType: 'ProjectSupport',
      entityId: existing.id,
      summary: `${actor.name} removed the support term`,
    });
  },

  /** Every support term in the workspace, for the studio overview screen. */
  async listForOwner(userId: string) {
    const now = new Date();
    const rows = await SupportModel.listForOwner(userId);
    return rows.map((row) => {
      const { project, ...support } = row;
      return { project, support: toSummary(support, true, now) };
    });
  },
};

export default SupportService;
