import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { ApiError } from '@utils/api-error';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendSuccess } from '@utils/api-response';
import { env } from '@config/env';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { sendTemplatedEmail } from './email-sender';
import {
  previewCatalogue,
  previewContext,
  previewEvent,
  previewIndexHtml,
  type PreviewableEvent,
} from './email-preview';
import { NotificationService } from './notification.service';
import { EVENT_TEMPLATES } from './notification.events';

const router = Router();

/**
 * Template gallery.
 *
 * Mounted before `authenticate` because it is opened in a browser tab and an
 * iframe, neither of which carries the in-memory access token. It renders
 * hard-coded sample data and touches no workspace record, so there is nothing
 * here to leak — but it is still development-only, since a public template
 * gallery on a production host is free reconnaissance for a phisher.
 */
if (!env.isProduction) {
  router.get('/email-templates/preview', (req: Request, res: Response) => {
    res.type('html').send(previewIndexHtml(req.baseUrl + '/email-templates/preview'));
  });

  router.get('/email-templates/preview/:event', (req: Request, res: Response) => {
    const event = String(req.params.event) as PreviewableEvent;
    const known = previewCatalogue().some((item) => item.event === event);
    if (!known) {
      res.status(404).type('html').send('<p style="font:14px sans-serif">No such template.</p>');
      return;
    }
    res.type('html').send(previewEvent(event).html);
  });
}

router.use(authenticate);

/**
 * The signed-in user's own notifications. Deliberately NOT behind
 * `requireInternal` — every user has an inbox, client members included.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as unknown as { user: { id: string } };
    const [items, unread] = await Promise.all([
      NotificationService.listForUser(user.id),
      NotificationService.unreadCount(user.id),
    ]);
    return sendSuccess(res, items, 'Notifications fetched', 200, { unread });
  }),
);

router.patch(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as unknown as { user: { id: string } };
    const { count } = await NotificationService.markAllRead(user.id);
    return sendSuccess(res, { updated: count }, 'All notifications marked read');
  }),
);

router.patch(
  '/:id/read',
  validate({ params: z.object({ id: z.string().min(1) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as unknown as { user: { id: string } };
    return sendSuccess(
      res,
      await NotificationService.markRead(user.id, String(req.params.id)),
      'Notification read',
    );
  }),
);

/**
 * Email delivery log. Restricted to the studio — it exposes recipient
 * addresses across the whole workspace.
 */
router.get(
  '/email-log',
  requireInternal,
  validate({
    query: z.object({
      projectId: z.string().min(1).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, page, limit } = req.query as unknown as {
      projectId?: string;
      page: number;
      limit: number;
    };
    const { items, total } = await NotificationService.emailLog(projectId, page, limit);
    return sendSuccess(res, items, 'Email log fetched', 200, buildPaginationMeta(page, limit, total));
  }),
);

/** The event catalogue, so the settings screen can show what triggers email. */
router.get(
  '/events',
  requireInternal,
  asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(
      res,
      Object.entries(EVENT_TEMPLATES).map(([event, template]) => ({
        event,
        channels: template.channels,
        sendsEmail: template.channels.includes('EMAIL'),
      })),
      'Notification events fetched',
    ),
  ),
);

/** The catalogue of email templates, for the settings screen. */
router.get(
  '/email-templates',
  requireInternal,
  asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, previewCatalogue(), 'Email templates fetched'),
  ),
);

/**
 * Sends one template to the signed-in user's own address.
 *
 * Deliberately ignores any recipient in the request — a "send test email"
 * endpoint that accepts an arbitrary address is an open relay for branded
 * mail, and this application's whole purpose is looking legitimate to clients.
 */
router.post(
  '/email-templates/:event/test',
  requireInternal,
  asyncHandler(async (req: Request, res: Response) => {
    const event = String(req.params.event) as PreviewableEvent;
    if (!previewCatalogue().some((item) => item.event === event)) {
      throw ApiError.notFound('Email template');
    }

    const user = (req as unknown as { user: { id: string; email: string; name: string } }).user;
    const result = await sendTemplatedEmail({
      to: user.email,
      event,
      userId: user.id,
      context: previewContext({ recipientName: user.name }),
      subject: `[Test] ${previewEvent(event).subject}`,
    });

    if (!result.ok) throw ApiError.badRequest(result.error ?? 'The test email could not be sent');
    return sendSuccess(res, result, `Test email sent to ${user.email}`);
  }),
);

export default router;
