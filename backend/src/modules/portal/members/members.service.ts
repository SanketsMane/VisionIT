import { ProjectRole, UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { recordActivity } from '@modules/portal/portal.activity';
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
