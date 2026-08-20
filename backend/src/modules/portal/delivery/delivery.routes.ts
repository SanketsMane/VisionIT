import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { uploadSourceArchive } from '@utils/private-storage';
import { DeliveryController } from './delivery.controller';
import {
  checklistItemParam,
  checklistToggleSchema,
  confirmTransferSchema,
  githubDetailsSchema,
  publishVersionSchema,
  setStatusSchema,
  sourceMethodSchema,
} from './delivery.validation';
import { projectIdParam } from '../invitations/invitations.validation';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/options', DeliveryController.options);

router.get(
  '/',
  validate({ params: projectIdParam }),
  requireProjectAccess('delivery:view'),
  DeliveryController.get,
);

router.get(
  '/readiness',
  validate({ params: projectIdParam }),
  requireProjectAccess('delivery:view'),
  DeliveryController.readiness,
);

router.get(
  '/handover-record',
  validate({ params: projectIdParam }),
  requireProjectAccess('delivery:view'),
  DeliveryController.handoverRecord,
);

router.get(
  '/archive',
  validate({ params: projectIdParam }),
  requireProjectAccess('delivery:view', 'document:download'),
  DeliveryController.downloadArchive,
);

// ---- Client-side actions ---------------------------------------------------

router.post(
  '/source-method',
  validate({ params: projectIdParam, body: sourceMethodSchema }),
  requireProjectAccess('delivery:confirm'),
  DeliveryController.chooseSourceMethod,
);

router.post(
  '/github',
  validate({ params: projectIdParam, body: githubDetailsSchema }),
  requireProjectAccess('delivery:confirm'),
  DeliveryController.submitGithub,
);

router.post(
  '/confirm-client',
  validate({ params: projectIdParam }),
  requireProjectAccess('delivery:confirm'),
  DeliveryController.confirmClient,
);

// ---- Studio-side actions ---------------------------------------------------

router.patch(
  '/status',
  validate({ params: projectIdParam, body: setStatusSchema }),
  requireProjectAccess('delivery:manage'),
  DeliveryController.setStatus,
);

router.patch(
  '/checklist/:itemId',
  validate({ params: checklistItemParam, body: checklistToggleSchema }),
  requireProjectAccess('delivery:manage'),
  DeliveryController.toggleChecklist,
);

router.post(
  '/github/confirm',
  validate({ params: projectIdParam, body: confirmTransferSchema }),
  requireProjectAccess('delivery:manage'),
  DeliveryController.confirmGithubTransfer,
);

router.post(
  '/archive',
  requireProjectAccess('delivery:manage'),
  uploadSourceArchive.single('archive'),
  DeliveryController.uploadArchive,
);

router.post(
  '/versions',
  validate({ params: projectIdParam, body: publishVersionSchema }),
  requireProjectAccess('delivery:manage'),
  DeliveryController.publishVersion,
);

router.post(
  '/confirm-admin',
  validate({ params: projectIdParam }),
  requireProjectAccess('delivery:manage'),
  DeliveryController.confirmAdmin,
);

export default router;
