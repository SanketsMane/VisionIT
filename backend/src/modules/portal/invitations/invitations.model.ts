import { InvitationStatus, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';

/** Never selects `tokenHash` — nothing above this layer needs it. */
export const invitationSelect = {
  id: true,
  projectId: true,
  email: true,
  name: true,
  role: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  lastSentAt: true,
  sendCount: true,
  createdAt: true,
  invitedBy: { select: { id: true, name: true } },
  acceptedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ProjectInvitationSelect;

export const InvitationsModel = {
  listForProject: (projectId: string, status?: InvitationStatus) =>
    prisma.projectInvitation.findMany({
      where: { projectId, ...(status ? { status } : {}) },
      select: invitationSelect,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (projectId: string, invitationId: string) =>
    prisma.projectInvitation.findFirst({
      where: { id: invitationId, projectId },
      select: invitationSelect,
    }),

  /** Token lookup for the public accept flow — includes what the page renders. */
  findByTokenHash: (tokenHash: string) =>
    prisma.projectInvitation.findUnique({
      where: { tokenHash },
      include: {
        project: {
          select: {
            id: true, title: true, code: true, logoUrl: true, summary: true,
            userId: true,
            user: { select: { name: true, company: { select: { legalName: true, tradeName: true, logoUrl: true } } } },
          },
        },
        invitedBy: { select: { name: true } },
      },
    }),

  pendingForEmail: (projectId: string, email: string) =>
    prisma.projectInvitation.findFirst({
      where: { projectId, email, status: InvitationStatus.PENDING },
    }),

  create: (data: Prisma.ProjectInvitationCreateInput) =>
    prisma.projectInvitation.create({ data, select: invitationSelect }),

  update: (id: string, data: Prisma.ProjectInvitationUpdateInput) =>
    prisma.projectInvitation.update({ where: { id }, data, select: invitationSelect }),

  markAccepted: (id: string, userId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.projectInvitation.update({
      where: { id },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        acceptedByUserId: userId,
      },
    }),

  /** Nightly sweep so a stale link reads as "expired" rather than "pending". */
  expireStale: () =>
    prisma.projectInvitation.updateMany({
      where: { status: InvitationStatus.PENDING, expiresAt: { lt: new Date() } },
      data: { status: InvitationStatus.EXPIRED },
    }),
};

export default InvitationsModel;
