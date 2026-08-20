import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { MembersController } from './members.controller';
import {
  addInternalSchema,
  attachExistingSchema,
  memberIdParam,
  searchAttachableSchema,
  updateRoleSchema,
} from './members.validation';
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

// Search before the `:memberId` routes, or "search" is read as a member id.
router.get(
  '/search',
  validate({ params: projectIdParam, query: searchAttachableSchema }),
  requireProjectAccess('team:manage'),
  MembersController.searchAttachable,
);

router.post(
  '/attach',
  validate({ params: projectIdParam, body: attachExistingSchema }),
  requireProjectAccess('team:manage', 'project:manage'),
  MembersController.attachExisting,
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
