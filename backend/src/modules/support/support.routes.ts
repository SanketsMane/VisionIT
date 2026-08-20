import { Router } from 'express';
import { z } from 'zod';
import { authenticate, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { SupportController } from './support.controller';
import { cancelSupportSchema, renewSupportSchema, upsertSupportSchema } from './support.validation';

const router = Router();

router.use(authenticate);
// Studio surface. Clients read their own term through the portal overview,
// which never exposes the internal note or the edit actions.
router.use(requireInternal);

const projectIdParam = z.object({ id: z.string().min(1) });

/** Renewals pipeline across every project. */
router.get('/', SupportController.list);

router.get('/:id', validate({ params: projectIdParam }), SupportController.get);

router.put(
  '/:id',
  validate({ params: projectIdParam, body: upsertSupportSchema }),
  logActivity('support.save', 'ProjectSupport'),
  SupportController.save,
);

router.post(
  '/:id/renew',
  validate({ params: projectIdParam, body: renewSupportSchema }),
  logActivity('support.renew', 'ProjectSupport'),
  SupportController.renew,
);

router.post(
  '/:id/cancel',
  validate({ params: projectIdParam, body: cancelSupportSchema }),
  logActivity('support.cancel', 'ProjectSupport'),
  SupportController.cancel,
);

router.delete(
  '/:id',
  validate({ params: projectIdParam }),
  logActivity('support.remove', 'ProjectSupport'),
  SupportController.remove,
);

export default router;
