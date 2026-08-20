import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { PaymentsController } from './payments.controller';
import { listPaymentsSchema, paymentIdSchema } from './payments.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', validate({ query: listPaymentsSchema }), PaymentsController.list);
router.get(
  '/stats',
  validate({ query: z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }) }),
  PaymentsController.stats,
);
router.get('/:id', validate({ params: paymentIdSchema }), PaymentsController.getById);

export default router;
