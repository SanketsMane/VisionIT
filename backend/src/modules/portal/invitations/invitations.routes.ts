import { Router } from 'express';
import { authenticate, authLimiter, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { InvitationsController } from './invitations.controller';
import {
  acceptAsExistingSchema,
  acceptInvitationSchema,
  createInvitationSchema,
  invitationIdParam,
  listInvitationsSchema,
  projectIdParam,
  tokenParam,
} from './invitations.validation';

/**
 * Public routes — the recipient has no account yet, so the token in the URL is
 * the only credential. Rate limited like any other credential endpoint.
 */
export const publicInviteRouter = Router();

publicInviteRouter.get(
  '/:token',
  authLimiter,
  validate({ params: tokenParam }),
  InvitationsController.preview,
);
publicInviteRouter.post(
  '/:token/accept',
  authLimiter,
  validate({ params: tokenParam, body: acceptInvitationSchema }),
  InvitationsController.acceptNew,
);
publicInviteRouter.post(
  '/:token/accept-existing',
  authLimiter,
  validate({ params: tokenParam, body: acceptAsExistingSchema }),
  InvitationsController.acceptExisting,
);

/** Project-scoped management, mounted under /portal/projects/:projectId. */
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/roles', InvitationsController.roles);

router.get(
  '/',
  validate({ params: projectIdParam, query: listInvitationsSchema }),
  requireProjectAccess('team:view'),
  InvitationsController.list,
);

router.post(
  '/',
  validate({ params: projectIdParam, body: createInvitationSchema }),
  requireProjectAccess('team:invite'),
  InvitationsController.create,
);

router.post(
  '/:invitationId/resend',
  validate({ params: invitationIdParam }),
  requireProjectAccess('team:manage'),
  InvitationsController.resend,
);

router.delete(
  '/:invitationId',
  validate({ params: invitationIdParam }),
  requireProjectAccess('team:manage'),
  InvitationsController.revoke,
);

export default router;
