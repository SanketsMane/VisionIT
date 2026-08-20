import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { DashboardController } from './dashboard.controller';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', DashboardController.overview);
router.get('/receivables', DashboardController.receivables);
router.get(
  '/trend',
  validate({ query: z.object({ months: z.coerce.number().int().min(1).max(36).default(12) }) }),
  DashboardController.trend,
);

export default router;
