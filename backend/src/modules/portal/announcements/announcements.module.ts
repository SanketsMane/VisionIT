import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { prisma } from '@config/database';
import { ApiError } from '@utils/api-error';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { authenticate, validate } from '@middlewares/index';
import { getProjectAccess, requireProjectAccess } from '@middlewares/project-access.middleware';
import { NotificationService } from '@modules/notifications/notification.service';
import { recordActivity } from '@modules/portal/portal.activity';
import type { AuthedRequest } from '@/types/common.types';
import { projectIdParam } from '../invitations/invitations.validation';

/**
 * Project announcements. Small enough to live in one file — a model, a service,
 * a controller and routes here would be four files of ceremony for three
 * operations.
 */

const announcementIdParam = z.object({
  projectId: z.string().min(1),
  announcementId: z.string().min(1),
});

const createSchema = z.object({
  title: z.string().trim().min(3, 'Give the announcement a title').max(200),
  body: z.string().trim().min(3, 'Write the announcement').max(10000),
  isPinned: z.boolean().default(false),
  notify: z.boolean().default(true),
});

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  isPinned: true,
  publishedAt: true,
  publishedBy: { select: { id: true, name: true, avatarUrl: true } },
} as const;

export const AnnouncementsService = {
  list: (projectId: string) =>
    prisma.announcement.findMany({
      where: { projectId },
      select: announcementSelect,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 100,
    }),

  async create(
    projectId: string,
    actor: { id: string; name: string },
    input: { title: string; body: string; isPinned: boolean; notify: boolean },
  ) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { title: true },
    });

    const announcement = await prisma.announcement.create({
      data: {
        projectId,
        title: input.title,
        body: input.body,
        isPinned: input.isPinned,
        publishedById: actor.id,
      },
      select: announcementSelect,
    });

    await recordActivity({
      projectId,
      actorId: actor.id,
      action: 'announcement.published',
      entityType: 'Announcement',
      entityId: announcement.id,
      summary: `${actor.name} posted "${input.title}"`,
    });

    // The whole point of announcements is to replace ad-hoc WhatsApp updates,
    // so notifying is the default rather than an afterthought.
    if (input.notify) {
      NotificationService.emitAsync({
        event: 'project.announcement',
        audience: { projectId, include: ['client'] },
        context: { projectName: project.title, title: input.title, body: input.body },
        projectId,
        link: `/portal/projects/${projectId}`,
      });
    }

    return announcement;
  },

  async remove(projectId: string, announcementId: string) {
    const existing = await prisma.announcement.findFirst({
      where: { id: announcementId, projectId },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound('Announcement');
    await prisma.announcement.delete({ where: { id: announcementId } });
  },
};

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get(
  '/',
  validate({ params: projectIdParam }),
  requireProjectAccess('announcement:view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await AnnouncementsService.list(projectId), 'Announcements fetched');
  }),
);

router.post(
  '/',
  validate({ params: projectIdParam, body: createSchema }),
  requireProjectAccess('announcement:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const announcement = await AnnouncementsService.create(
      projectId,
      { id: user.id, name: user.name },
      req.body,
    );
    return sendCreated(res, announcement, 'Announcement published');
  }),
);

router.delete(
  '/:announcementId',
  validate({ params: announcementIdParam }),
  requireProjectAccess('announcement:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    await AnnouncementsService.remove(projectId, params.announcementId);
    return sendSuccess(res, null, 'Announcement removed');
  }),
);

export default router;
