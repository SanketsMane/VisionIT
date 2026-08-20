import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';

/**
 * Data access for support terms.
 *
 * Nothing here computes state or formats anything — the service owns that, so
 * a query can be changed without touching the countdown maths.
 */
export const SupportModel = {
  findByProject: (projectId: string) =>
    prisma.projectSupport.findUnique({ where: { projectId } }),

  upsert: (projectId: string, create: Prisma.ProjectSupportCreateInput, update: Prisma.ProjectSupportUpdateInput) =>
    prisma.projectSupport.upsert({ where: { projectId }, create, update }),

  update: (projectId: string, data: Prisma.ProjectSupportUpdateInput) =>
    prisma.projectSupport.update({ where: { projectId }, data }),

  remove: (projectId: string) => prisma.projectSupport.delete({ where: { projectId } }),

  /**
   * Terms the daily sweep should look at: live, not cancelled, and either
   * inside the reminder window or already past the end date.
   */
  dueForReminder: (horizon: Date) =>
    prisma.projectSupport.findMany({
      where: {
        isCancelled: false,
        endDate: { lte: horizon },
        project: { deletedAt: null },
      },
      include: {
        project: { select: { id: true, title: true, code: true, userId: true } },
      },
    }),

  /** Support terms across the whole workspace, for the studio list screen. */
  listForOwner: (userId: string) =>
    prisma.projectSupport.findMany({
      where: { project: { userId, deletedAt: null } },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            code: true,
            client: { select: { id: true, name: true, companyName: true } },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
};

export default SupportModel;
