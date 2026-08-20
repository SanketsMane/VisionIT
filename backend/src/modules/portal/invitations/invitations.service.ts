import { InvitationStatus, ProjectRole, UserType } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { generateToken, sha256 } from '@utils/crypto.util';
import { hashPassword, verifyPassword } from '@utils/password.util';
import { addDays, formatDate } from '@utils/date.util';
import { sendTemplatedEmail } from '@modules/notifications/email-sender';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';
import { CLIENT_ASSIGNABLE_ROLES, ROLE_LABELS } from '@modules/portal/portal.permissions';
import { InvitationsModel } from './invitations.model';
import type { AcceptInvitationDto, CreateInvitationDto } from './invitations.validation';

const inviteUrl = (token: string): string => `${env.CLIENT_URL}/invite/${token}`;

export const InvitationsService = {
  list: (projectId: string, status?: InvitationStatus) =>
    InvitationsModel.listForProject(projectId, status),

  /**
   * Issues an invitation.
   *
   * The raw token is returned exactly once — only its SHA-256 is stored, so a
   * database leak can't be replayed as a working invite link, and even an admin
   * re-opening the list can't recover the URL (they regenerate instead).
   */
  async create(
    projectId: string,
    invitedById: string,
    dto: CreateInvitationDto,
    actorName: string,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true },
    });
    if (!project) throw ApiError.notFound('Project');

    // Someone already on the project doesn't need an invitation.
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId, user: { email: dto.email }, isActive: true },
      select: { id: true },
    });
    if (existingMember) {
      throw ApiError.conflict('That person is already a member of this project');
    }

    const pending = await InvitationsModel.pendingForEmail(projectId, dto.email);
    if (pending) {
      throw ApiError.conflict(
        'An invitation is already pending for that address. Revoke or resend it instead.',
      );
    }

    const token = generateToken(32);

    const invitation = await InvitationsModel.create({
      project: { connect: { id: projectId } },
      email: dto.email,
      name: dto.name ?? null,
      role: dto.role,
      tokenHash: sha256(token),
      expiresAt: addDays(new Date(), dto.expiresInDays),
      lastSentAt: new Date(),
      sendCount: 1,
      invitedBy: { connect: { id: invitedById } },
    });

    await recordActivity({
      projectId,
      actorId: invitedById,
      action: 'invitation.created',
      entityType: 'ProjectInvitation',
      entityId: invitation.id,
      summary: `Invited ${dto.email} as ${ROLE_LABELS[dto.role]}`,
    });

    NotificationService.emitAsync({
      event: dto.role === ProjectRole.CLIENT_OWNER ? 'project.client_invited' : 'project.member_invited',
      userIds: [],
      context: {
        projectName: project.title,
        actorName,
        role: ROLE_LABELS[dto.role],
        inviteUrl: inviteUrl(token),
      },
      projectId,
    });

    // Delivered directly rather than through the audience resolver, because the
    // recipient has no account yet and therefore no membership to resolve.
    await this.deliverInvitationEmail(
      dto.email,
      project.title,
      actorName,
      dto.role,
      token,
      projectId,
      dto.name,
      invitation.expiresAt,
    );

    logger.info('Project invitation created', { projectId, email: dto.email, role: dto.role });

    return { invitation, inviteUrl: inviteUrl(token) };
  },

  /**
   * Sends the invite email to an address that has no user record yet.
   *
   * Delivered directly rather than through `NotificationService.emit`, because
   * that resolves recipients from project membership and an invitee has none.
   */
  async deliverInvitationEmail(
    email: string,
    projectName: string,
    actorName: string,
    role: ProjectRole,
    token: string,
    projectId: string,
    recipientName?: string | null,
    expiresAt?: Date,
  ): Promise<void> {
    await sendTemplatedEmail({
      to: email,
      event: role === ProjectRole.CLIENT_OWNER ? 'project.client_invited' : 'project.member_invited',
      projectId,
      context: {
        recipientName: recipientName ?? undefined,
        projectName,
        actorName,
        role: ROLE_LABELS[role],
        actionUrl: inviteUrl(token),
        actionLabel: 'Accept invitation',
        expiresAt: expiresAt ? formatDate(expiresAt) : undefined,
      },
    });
  },

  /**
   * Regenerates the token and resends. Used both for "resend" and "regenerate"
   * — the old link stops working either way, which is the safer default.
   */
  async resend(projectId: string, invitationId: string, actorId: string, actorName: string) {
    const existing = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, projectId },
      include: { project: { select: { title: true } } },
    });
    if (!existing) throw ApiError.notFound('Invitation');
    if (existing.status === InvitationStatus.ACCEPTED) {
      throw ApiError.badRequest('That invitation has already been accepted');
    }

    const token = generateToken(32);

    const invitation = await InvitationsModel.update(invitationId, {
      tokenHash: sha256(token),
      status: InvitationStatus.PENDING,
      expiresAt: addDays(new Date(), 14),
      revokedAt: null,
      lastSentAt: new Date(),
      sendCount: { increment: 1 },
    });

    await recordActivity({
      projectId,
      actorId,
      action: 'invitation.resent',
      entityType: 'ProjectInvitation',
      entityId: invitationId,
      summary: `Re-sent the invitation to ${existing.email} with a new link`,
    });

    await this.deliverInvitationEmail(
      existing.email,
      existing.project.title,
      actorName,
      existing.role,
      token,
      projectId,
      existing.name,
      invitation.expiresAt,
    );

    return { invitation, inviteUrl: inviteUrl(token) };
  },

  async revoke(projectId: string, invitationId: string, actorId: string) {
    const existing = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, projectId },
    });
    if (!existing) throw ApiError.notFound('Invitation');
    if (existing.status === InvitationStatus.ACCEPTED) {
      throw ApiError.badRequest(
        'That invitation was already accepted. Remove the member from the team instead.',
      );
    }

    const invitation = await InvitationsModel.update(invitationId, {
      status: InvitationStatus.REVOKED,
      revokedAt: new Date(),
      // Replacing the hash makes the outstanding link unusable immediately.
      tokenHash: sha256(generateToken(32)),
    });

    await recordActivity({
      projectId,
      actorId,
      action: 'invitation.revoked',
      entityType: 'ProjectInvitation',
      entityId: invitationId,
      summary: `Revoked the invitation for ${existing.email}`,
    });

    return invitation;
  },

  /**
   * Public preview of an invite link. Returns only what the landing page needs
   * to render — never the workspace id, the inviter's email, or project financials.
   */
  async preview(token: string) {
    const invitation = await InvitationsModel.findByTokenHash(sha256(token));
    if (!invitation) throw ApiError.notFound('Invitation');

    if (invitation.status === InvitationStatus.REVOKED) {
      throw ApiError.badRequest('This invitation has been revoked. Please ask for a new link.');
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw ApiError.badRequest('This invitation has already been used. Sign in instead.');
    }
    if (invitation.expiresAt < new Date()) {
      if (invitation.status === InvitationStatus.PENDING) {
        await InvitationsModel.update(invitation.id, { status: InvitationStatus.EXPIRED });
      }
      throw ApiError.badRequest('This invitation has expired. Please ask for a new link.');
    }

    const company = invitation.project.user.company;
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return {
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      roleLabel: ROLE_LABELS[invitation.role],
      expiresAt: invitation.expiresAt,
      /** Tells the landing page whether to show sign-up or sign-in. */
      hasAccount: Boolean(existingUser),
      project: {
        title: invitation.project.title,
        code: invitation.project.code,
        summary: invitation.project.summary,
        logoUrl: invitation.project.logoUrl,
      },
      invitedBy: invitation.invitedBy.name,
      studio: {
        name: company?.tradeName ?? company?.legalName ?? invitation.project.user.name,
        logoUrl: company?.logoUrl ?? null,
      },
    };
  },

  /** Loads and validates an invitation for the accept flow. */
  async loadAcceptable(token: string) {
    const invitation = await InvitationsModel.findByTokenHash(sha256(token));
    if (!invitation) throw ApiError.notFound('Invitation');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw ApiError.badRequest('This invitation is no longer valid');
    }
    if (invitation.expiresAt < new Date()) {
      await InvitationsModel.update(invitation.id, { status: InvitationStatus.EXPIRED });
      throw ApiError.badRequest('This invitation has expired');
    }
    return invitation;
  },

  /**
   * Registers a brand-new client user and joins them to the project.
   *
   * The account is created as a CLIENT owned by the project's workspace, so it
   * can never be mistaken for an internal user with a workspace of its own.
   */
  async acceptAsNewUser(token: string, dto: AcceptInvitationDto) {
    const invitation = await this.loadAcceptable(token);

    const existing = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict(
        'An account already exists for this email. Sign in to accept the invitation.',
      );
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: invitation.email,
          passwordHash,
          phone: dto.mobile.trim(),
          userType: UserType.CLIENT,
          ownerId: invitation.project.userId,
          emailVerified: true,
          isActive: true,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId: created.id,
          role: invitation.role,
          invitedById: invitation.invitedById,
        },
      });

      await InvitationsModel.markAccepted(invitation.id, created.id, tx);

      await recordActivity(
        {
          projectId: invitation.projectId,
          actorId: created.id,
          action: 'invitation.accepted',
          entityType: 'User',
          entityId: created.id,
          summary: `${dto.name.trim()} accepted the invitation and joined as ${ROLE_LABELS[invitation.role]}`,
        },
        tx,
      );

      return created;
    });

    NotificationService.emitAsync({
      event: 'project.client_registered',
      audience: { projectId: invitation.projectId, include: ['internal'] },
      context: { projectName: invitation.project.title, actorName: user.name },
      projectId: invitation.projectId,
      link: `/projects/${invitation.projectId}`,
    });

    logger.info('Client accepted invitation', {
      projectId: invitation.projectId,
      userId: user.id,
      role: invitation.role,
    });

    return { user, projectId: invitation.projectId };
  },

  /**
   * Joins an existing portal user to another project. Credentials are verified
   * here so a stolen link alone can't attach someone else's account.
   */
  async acceptAsExistingUser(token: string, email: string, password: string) {
    const invitation = await this.loadAcceptable(token);

    if (email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw ApiError.badRequest('This invitation was issued to a different email address');
    }

    const user = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (!user) throw ApiError.badRequest('No account found for this address. Create one instead.');

    if (!(await verifyPassword(password, user.passwordHash))) {
      throw ApiError.unauthorized('Incorrect password');
    }
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');
    if (user.userType !== UserType.CLIENT) {
      throw ApiError.badRequest('Studio accounts already have access to every project');
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } },
        update: { role: invitation.role, isActive: true },
        create: {
          projectId: invitation.projectId,
          userId: user.id,
          role: invitation.role,
          invitedById: invitation.invitedById,
        },
      });

      await InvitationsModel.markAccepted(invitation.id, user.id, tx);

      await recordActivity(
        {
          projectId: invitation.projectId,
          actorId: user.id,
          action: 'member.joined',
          entityType: 'User',
          entityId: user.id,
          summary: `${user.name} joined as ${ROLE_LABELS[invitation.role]}`,
        },
        tx,
      );
    });

    NotificationService.emitAsync({
      event: 'project.member_joined',
      audience: { projectId: invitation.projectId, include: ['internal'], excludeUserIds: [user.id] },
      context: {
        projectName: invitation.project.title,
        actorName: user.name,
        role: ROLE_LABELS[invitation.role],
      },
      projectId: invitation.projectId,
    });

    return { user, projectId: invitation.projectId };
  },

  /** Roles a client-side member may hand out — never CLIENT_OWNER or INTERNAL. */
  assignableClientRoles: () =>
    CLIENT_ASSIGNABLE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
};

export default InvitationsService;
