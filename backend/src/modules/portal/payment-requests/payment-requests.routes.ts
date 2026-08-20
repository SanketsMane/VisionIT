import { Router } from 'express';
import { authenticate, validate } from '@middlewares/index';
import { requireProjectAccess } from '@middlewares/project-access.middleware';
import { uploadPaymentProof } from '@utils/private-storage';
import { PaymentRequestsController } from './payment-requests.controller';
import {
  approveSchema,
  listSchema,
  rejectSchema,
  requestIdParam,
  submitPaymentSchema,
} from './payment-requests.validation';
import { projectIdParam } from '../invitations/invitations.validation';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.get(
  '/',
  validate({ params: projectIdParam, query: listSchema }),
  requireProjectAccess('payment:view'),
  PaymentRequestsController.list,
);

router.post(
  '/',
  // Multer runs before validation so the multipart body is parsed into fields.
  requireProjectAccess('payment:submit'),
  uploadPaymentProof.single('proof'),
  validate({ body: submitPaymentSchema }),
  PaymentRequestsController.submit,
);

router.get(
  '/:requestId',
  validate({ params: requestIdParam }),
  requireProjectAccess('payment:view'),
  PaymentRequestsController.getById,
);

router.get(
  '/:requestId/proof',
  validate({ params: requestIdParam }),
  requireProjectAccess('payment:view'),
  PaymentRequestsController.proof,
);

router.post(
  '/:requestId/approve',
  validate({ params: requestIdParam, body: approveSchema }),
  requireProjectAccess('payment:approve'),
  PaymentRequestsController.approve,
);

router.post(
  '/:requestId/reject',
  validate({ params: requestIdParam, body: rejectSchema }),
  requireProjectAccess('payment:approve'),
  PaymentRequestsController.reject,
);

router.post(
  '/:requestId/cancel',
  validate({ params: requestIdParam }),
  requireProjectAccess('payment:submit'),
  PaymentRequestsController.cancel,
);

export default router;
