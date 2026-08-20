import { Router } from 'express';
import invitationRoutes, { publicInviteRouter } from './invitations/invitations.routes';
import memberRoutes from './members/members.routes';
import paymentRequestRoutes from './payment-requests/payment-requests.routes';
import bugRoutes from './bugs/bugs.routes';
import documentRoutes from './documents/documents.routes';
import deliveryRoutes from './delivery/delivery.routes';
import announcementRoutes from './announcements/announcements.module';
import workspaceRoutes, { portalTopLevelRouter } from './workspace/workspace.routes';

/**
 * Everything a project workspace contains, mounted under one project id.
 *
 * `mergeParams` lets every child router read `:projectId`, which is what the
 * `requireProjectAccess` guard keys off — so no sub-route can be reached
 * without membership having been checked first.
 */
const projectRouter = Router({ mergeParams: true });

projectRouter.use('/invitations', invitationRoutes);
projectRouter.use('/members', memberRoutes);
projectRouter.use('/payment-requests', paymentRequestRoutes);
projectRouter.use('/bugs', bugRoutes);
projectRouter.use('/documents', documentRoutes);
projectRouter.use('/delivery', deliveryRoutes);
projectRouter.use('/announcements', announcementRoutes);
projectRouter.use('/', workspaceRoutes);

const router = Router();

// Public: the invite landing page and account creation.
router.use('/invite', publicInviteRouter);

// Authenticated, workspace-level.
router.use('/', portalTopLevelRouter);

// Authenticated, project-scoped.
router.use('/projects/:projectId', projectRouter);

export default router;
