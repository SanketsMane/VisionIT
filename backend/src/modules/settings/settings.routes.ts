import { Router } from 'express';
import { z } from 'zod';
import { authenticate, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { SettingsController } from './settings.controller';
import { companyProfileSchema, updateProfileSchema } from './settings.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

const idParam = z.object({ id: z.string().min(1) });
const pageQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

router.get('/reference', SettingsController.reference);

router.get('/company', SettingsController.getCompany);
router.patch(
  '/company',
  validate({ body: companyProfileSchema.partial() }),
  logActivity('settings.company.update', 'CompanyProfile', () => undefined),
  SettingsController.updateCompany,
);

router.patch('/profile', validate({ body: updateProfileSchema }), SettingsController.updateProfile);

router.get('/activity', validate({ query: pageQuery }), SettingsController.activity);

router.get('/notifications', SettingsController.notifications);
router.patch('/notifications/:id/read', validate({ params: idParam }), SettingsController.markNotificationRead);
router.patch('/notifications/read-all', SettingsController.markAllRead);

export default router;
