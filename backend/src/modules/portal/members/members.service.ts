import { ProjectRole, UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { env } from '@config/env';
import { recordActivity } from '@modules/portal/portal.activity';
import { NotificationService } from '@modules/notifications/notification.service';
import {
  CLIENT_ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  permissionsFor,
} from '@modules/portal/portal.permissions';

const memberSelect = {
  id: true,
  role: true,
  isActive: true,
  joinedAt: true,
  user: {
    select: {
      id: true, name: true, email: true, phone: true,
      avatarUrl: true, userType: true, lastLoginAt: true,
    },
  },
} as const;

export const MembersService = {
  async list(projectId: string) {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: memberSelect,
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((member) => ({
      ...member,
      roleLabel: ROLE_LABELS[member.role],
      permissions: permissionsFor(member.role),
    }));
  },

  /**
   * Changes a member's role.
   *
   * Two guardrails: a client-side actor can only hand out client roles (never
   * INTERNAL_MEMBER, which would grant access to internal bug comments), and
   * the last active Client Owner cannot be demoted, which would strand the
   * project with nobody able to confirm delivery.
   */
  async updateRole(
    projectId: string,
    memberId: string,
    role: ProjectRole,
    actor: { id: string; isInternal: boolean },
  ) {
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { ...memberSelect, userId: true },
    });
    if (!member) throw ApiError.notFound('Team member');

    if (!actor.isInternal && !CLIENT_ASSIGNABLE_ROLES.includes(role)) {
      throw ApiError.forbidden(`You cannot assign the ${ROLE_LABELS[role]} role`);
    }

    if (member.role === ProjectRole.INTERNAL_MEMBER && !actor.isInternal) {
      throw ApiError.forbidden('You cannot change the role of a studio team member');
    }

    if (member.role === ProjectRole.CLIENT_OWNER && role !== ProjectRole.CLIENT_OWNER) {
      const owners = await prisma.projectMember.count({
        where: { projectId, role: ProjectRole.CLIENT_OWNER, isActive: true },
      });
      if (owners <= 1) {
        throw ApiError.badRequest(
          'This is the only Client Owner. Promote someone else before changing this role.',
        );
      }
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
      select: memberSelect,
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'member.role_changed',
      entityType: 'ProjectMember',
      entityId: memberId,
      summary: `${member.user.name} is now ${ROLE_LABELS[role]}`,
      field: 'role',
      oldValue: member.role,
      newValue: role,
    });

    return { ...updated, roleLabel: ROLE_LABELS[updated.role] };
  },

  /**
   * Removes access. Deactivates rather than deletes, so the person's bug
   * reports, comments and payment submissions keep their author.
   */
  async remove(projectId: string, memberId: string, actor: { id: string; isInternal: boolean }) {
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { ...memberSelect, userId: true },
    });
    if (!member) throw ApiError.notFound('Team member');

    if (member.role === ProjectRole.INTERNAL_MEMBER && !actor.isInternal) {
      throw ApiError.forbidden('You cannot remove a studio team member');
    }

    if (member.role === ProjectRole.CLIENT_OWNER) {
      const owners = await prisma.projectMember.count({
        where: { projectId, role: ProjectRole.CLIENT_OWNER, isActive: true },
      });
      if (owners <= 1) {
        throw ApiError.badRequest(
          'This is the only Client Owner. Promote someone else before removing them.',
        );
      }
    }

    if (member.userId === actor.id) {
      throw ApiError.badRequest('You cannot remove yourself from the project');
    }

    await prisma.projectMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'member.removed',
      entityType: 'ProjectMember',
      entityId: memberId,
      summary: `${member.user.name} was removed from the project`,
    });
  },

  /** Re-grants access to a previously removed member. */
  async restore(projectId: string, memberId: string, actorId: string) {
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { ...memberSelect, userId: true },
    });
    if (!member) throw ApiError.notFound('Team member');

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { isActive: true },
      select: memberSelect,
    });

    await recordActivity({
      projectId,
      actorId,
      action: 'member.joined',
      entityType: 'ProjectMember',
      entityId: memberId,
      summary: `${member.user.name} was given access again`,
    });

    return updated;
  },

  /** Adds an internal teammate directly — no invitation needed. */
  async addInternal(projectId: string, userId: string, actorId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, userType: UserType.INTERNAL, isActive: true },
      select: { id: true, name: true },
    });
    if (!user) throw ApiError.badRequest('That studio account does not exist');

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { isActive: true, role: ProjectRole.INTERNAL_MEMBER },
      create: {
        projectId,
        userId,
        role: ProjectRole.INTERNAL_MEMBER,
        invitedById: actorId,
      },
      select: memberSelect,
    });

    await recordActivity({
      projectId,
      actorId,
      action: 'member.joined',
      entityType: 'ProjectMember',
      entityId: member.id,
      summary: `${user.name} was assigned to the project`,
      isInternal: true,
    });

    return member;
  },

  /**
   * People the studio can drop straight into a project.
   *
   * Leads who signed up on the website already have a working account, so
   * adding one is an attach, not an invitation — no email round-trip, no token
   * to expire. Existing members are filtered out rather than shown greyed: a
   * name in a search result that cannot be picked reads as a bug.
   */
  async searchAttachable(projectId: string, ownerId: string, term: string) {
    const query = term.trim();
    if (query.length < 2) return [];

    const already = await prisma.projectMember.findMany({
      where: { projectId, isActive: true },
      select: { userId: true },
    });
    const taken = already.map((row) => row.userId);

    return prisma.user.findMany({
      where: {
        ownerId,
        userType: { in: [UserType.LEAD, UserType.CLIENT] },
        isActive: true,
        ...(taken.length ? { id: { notIn: taken } } : {}),
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { leadCompany: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        userType: true, leadCompany: true, leadSource: true, leadStatus: true,
      },
      orderBy: [{ userType: 'asc' }, { name: 'asc' }],
      take: 10,
    });
  },

  /**
   * Attach an existing lead or client account to a project.
   *
   * Scoped to `ownerId` so one workspace cannot pull another's users in, and
   * restricted to the client-assignable roles so this path can never hand out
   * an internal role.
   */
  async attachExisting(
    projectId: string,
    ownerId: string,
    userId: string,
    role: ProjectRole,
    actorId: string,
  ) {
    if (!CLIENT_ASSIGNABLE_ROLES.includes(role)) {
      throw ApiError.badRequest('That role cannot be given to a portal user');
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        ownerId,
        userType: { in: [UserType.LEAD, UserType.CLIENT] },
        isActive: true,
      },
      select: { id: true, name: true, email: true, userType: true },
    });
    if (!user) throw ApiError.badRequest('That account does not exist in your workspace');

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: ownerId },
      select: { id: true, title: true },
    });
    if (!project) throw ApiError.notFound('Project not found');

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { name: true },
    });

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { isActive: true, role },
      create: { projectId, userId, role, invitedById: actorId },
      select: memberSelect,
    });

    // A lead who now has a project is no longer just a lead. The account type
    // stays LEAD — that is what keeps their Catalog tab — but the funnel
    // status moves so the pipeline count stops being wrong.
    if (user.userType === UserType.LEAD) {
      await prisma.user.update({
        where: { id: userId },
        data: { leadStatus: 'CONVERTED' },
      });
    }

    await recordActivity({
      projectId,
      actorId,
      action: 'member.joined',
      entityType: 'ProjectMember',
      entityId: member.id,
      summary: `${user.name} was added to the project`,
      isInternal: false,
    });

    NotificationService.emitAsync({
      event: 'lead.added_to_project',
      userIds: [user.id],
      link: `/portal/projects/${projectId}`,
      context: {
        recipientName: user.name,
        actorName: actor?.name ?? 'The team',
        projectName: project.title,
        actionUrl: `${env.CLIENT_URL}/portal/projects/${projectId}`,
      },
    });

    return member;
  },

  roleCatalogue: () =>
    Object.values(ProjectRole).map((role) => ({
      value: role,
      label: ROLE_LABELS[role],
      description: ROLE_DESCRIPTIONS[role],
      permissions: permissionsFor(role),
      clientAssignable: CLIENT_ASSIGNABLE_ROLES.includes(role),
    })),
};

export default MembersService;
