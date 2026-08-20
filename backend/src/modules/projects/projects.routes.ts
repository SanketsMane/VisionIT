import { Router } from 'express';
import { z } from 'zod';
import { authenticate, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { ProjectsController } from './projects.controller';
import {
  createProjectSchema,
  listProjectsSchema,
  logHoursSchema,
  milestoneSchema,
  projectIdSchema,
  reorderSchema,
  updateProjectSchema,
} from './projects.validation';

const router = Router();

const milestoneParams = z.object({ id: z.string().min(1), milestoneId: z.string().min(1) });

/** Public catalog endpoint — no auth, used by an external portfolio site. */
router.get(
  '/public/:userId/:slug',
  validate({ params: z.object({ userId: z.string().min(1), slug: z.string().min(1) }) }),
  ProjectsController.getPublicBySlug,
);

router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', validate({ query: listProjectsSchema }), ProjectsController.list);
router.get('/stats', ProjectsController.stats);
router.get('/technologies', ProjectsController.technologies);
router.get('/:id', validate({ params: projectIdSchema }), ProjectsController.getById);

router.post(
  '/',
  validate({ body: createProjectSchema }),
  logActivity('project.create', 'Project'),
  ProjectsController.create,
);
router.patch('/reorder', validate({ body: reorderSchema }), ProjectsController.reorder);
router.patch(
  '/:id',
  validate({ params: projectIdSchema, body: updateProjectSchema }),
  logActivity('project.update', 'Project'),
  ProjectsController.update,
);
router.delete(
  '/:id',
  validate({ params: projectIdSchema }),
  logActivity('project.delete', 'Project'),
  ProjectsController.remove,
);
router.post('/:id/log-hours', validate({ params: projectIdSchema, body: logHoursSchema }), ProjectsController.logHours);

router.post('/:id/milestones', validate({ params: projectIdSchema, body: milestoneSchema }), ProjectsController.addMilestone);
router.patch(
  '/:id/milestones/:milestoneId',
  validate({ params: milestoneParams, body: milestoneSchema.partial().extend({ completed: z.boolean().optional() }) }),
  ProjectsController.updateMilestone,
);
router.delete('/:id/milestones/:milestoneId', validate({ params: milestoneParams }), ProjectsController.removeMilestone);

export default router;
