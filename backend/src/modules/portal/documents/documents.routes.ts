import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { uploadProjectDocument } from '@utils/private-storage';
import { DocumentsController } from './documents.controller';
import {
  documentIdParam,
  listDocumentsSchema,
  updateDocumentSchema,
  uploadDocumentSchema,
} from './documents.validation';
import { projectIdParam } from '../invitations/invitations.validation';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get(
  '/',
  validate({ params: projectIdParam, query: listDocumentsSchema }),
  requireProjectAccess('document:view'),
  DocumentsController.list,
);

router.get(
  '/stats',
  validate({ params: projectIdParam }),
  requireProjectAccess('document:view'),
  DocumentsController.stats,
);

router.post(
  '/',
  requireProjectAccess('document:manage'),
  uploadProjectDocument.single('file'),
  validate({ body: uploadDocumentSchema }),
  DocumentsController.upload,
);

router.get(
  '/:documentId/download',
  validate({ params: documentIdParam }),
  requireProjectAccess('document:download'),
  DocumentsController.download,
);

router.get(
  '/:documentId/history',
  validate({ params: documentIdParam }),
  requireProjectAccess('document:manage'),
  DocumentsController.history,
);

router.patch(
  '/:documentId',
  validate({ params: documentIdParam, body: updateDocumentSchema }),
  requireProjectAccess('document:manage'),
  DocumentsController.update,
);

router.delete(
  '/:documentId',
  validate({ params: documentIdParam }),
  requireProjectAccess('document:manage'),
  DocumentsController.remove,
);

export default router;
