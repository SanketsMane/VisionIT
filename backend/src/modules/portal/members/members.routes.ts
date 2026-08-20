import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { MembersController } from './members.controller';
import { addInternalSchema, memberIdParam, updateRoleSchema } from './members.validation';
import { projectIdParam } from '../invitations/invitations.validation';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/roles', MembersController.roles);

router.get(
  '/',
  validate({ params: projectIdParam }),
  requireProjectAccess('team:view'),
  MembersController.list,
);

router.post(
  '/internal',
  validate({ params: projectIdParam, body: addInternalSchema }),
  requireProjectAccess('team:manage', 'project:manage'),
  MembersController.addInternal,
);

router.patch(
  '/:memberId/role',
  validate({ params: memberIdParam, body: updateRoleSchema }),
  requireProjectAccess('team:manage'),
  MembersController.updateRole,
);

router.post(
  '/:memberId/restore',
  validate({ params: memberIdParam }),
  requireProjectAccess('team:manage'),
  MembersController.restore,
);

router.delete(
  '/:memberId',
  validate({ params: memberIdParam }),
  requireProjectAccess('team:manage'),
  MembersController.remove,
);

export default router;
