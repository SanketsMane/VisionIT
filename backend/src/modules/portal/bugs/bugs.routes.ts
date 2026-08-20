import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { uploadBugAttachment } from '@utils/private-storage';
import { BugsController } from './bugs.controller';
import {
  acknowledgeSchema,
  attachmentParam,
  bugIdParam,
  changeStatusSchema,
  commentSchema,
  createBugSchema,
  listBugsSchema,
  updateBugSchema,
} from './bugs.validation';
import { projectIdParam } from '../invitations/invitations.validation';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/options', BugsController.options);

router.get(
  '/',
  validate({ params: projectIdParam, query: listBugsSchema }),
  requireProjectAccess('bug:view'),
  BugsController.list,
);

router.get(
  '/stats',
  validate({ params: projectIdParam }),
  requireProjectAccess('bug:view'),
  BugsController.stats,
);

router.get(
  '/modules',
  validate({ params: projectIdParam }),
  requireProjectAccess('bug:view'),
  BugsController.modules,
);

router.post(
  '/',
  requireProjectAccess('bug:create'),
  uploadBugAttachment.array('attachments', 5),
  validate({ body: createBugSchema }),
  BugsController.create,
);

router.get(
  '/:bugId',
  validate({ params: bugIdParam }),
  requireProjectAccess('bug:view'),
  BugsController.getById,
);

router.patch(
  '/:bugId',
  validate({ params: bugIdParam, body: updateBugSchema }),
  requireProjectAccess('bug:manage'),
  BugsController.update,
);

router.post(
  '/:bugId/acknowledge',
  validate({ params: bugIdParam, body: acknowledgeSchema }),
  requireProjectAccess('bug:manage'),
  BugsController.acknowledge,
);

router.post(
  '/:bugId/status',
  validate({ params: bugIdParam, body: changeStatusSchema }),
  // Testers legitimately move their own issues to retest/closed, so this is
  // gated on commenting rather than full management.
  requireProjectAccess('bug:comment'),
  BugsController.changeStatus,
);

router.post(
  '/:bugId/comments',
  validate({ params: bugIdParam, body: commentSchema }),
  requireProjectAccess('bug:comment'),
  BugsController.comment,
);

router.post(
  '/:bugId/attachments',
  requireProjectAccess('bug:comment'),
  uploadBugAttachment.array('attachments', 5),
  BugsController.addAttachments,
);

router.get(
  '/:bugId/attachments/:attachmentId',
  validate({ params: attachmentParam }),
  requireProjectAccess('bug:view'),
  BugsController.attachment,
);

export default router;
