import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal, requireProjectAccess } from '@middlewares/project-access.middleware';
import { WorkspaceController } from './workspace.controller';
import { PaymentRequestsController } from '../payment-requests/payment-requests.controller';
import { projectIdParam } from '../invitations/invitations.validation';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get(
  '/',
  validate({ params: projectIdParam }),
  requireProjectAccess('project:view'),
  WorkspaceController.overview,
);

router.get(
  '/invoices',
  validate({ params: projectIdParam }),
  requireProjectAccess('invoice:view'),
  WorkspaceController.invoices,
);

router.get(
  '/activity',
  validate({
    params: projectIdParam,
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(30),
    }),
  }),
  requireProjectAccess('activity:view'),
  WorkspaceController.activity,
);

/** Workspace-level routes, not scoped to a single project. */
export const portalTopLevelRouter = Router();
portalTopLevelRouter.use(authenticate);

portalTopLevelRouter.get('/my-projects', WorkspaceController.myProjects);
portalTopLevelRouter.get('/clients', requireInternal, WorkspaceController.clients);
portalTopLevelRouter.get('/delivery-board', requireInternal, WorkspaceController.deliveryBoard);

/** Cross-project approvals queue — the admin's "Payment Requests" screen. */
portalTopLevelRouter.get(
  '/payment-requests',
  requireInternal,
  validate({
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
    }),
  }),
  PaymentRequestsController.queue,
);

export default router;
