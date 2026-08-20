import { Router } from 'express';
import { z } from 'zod';
import { authenticate, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { InvoicesController } from './invoices.controller';
import {
  changeStatusSchema,
  createInvoiceSchema,
  invoiceFields,
  duplicateSchema,
  emailInvoiceSchema,
  invoiceIdSchema,
  listInvoicesSchema,
  numberSequenceSchema,
  publicTokenSchema,
  recordPaymentSchema,
  updateInvoiceSchema,
} from './invoices.validation';

const router = Router();

const paymentParams = z.object({ id: z.string().min(1), paymentId: z.string().min(1) });

/** Client-facing share links — token in the URL is the only credential. */
router.get('/public/:token', validate({ params: publicTokenSchema }), InvoicesController.getPublic);
router.get('/public/:token/preview', validate({ params: publicTokenSchema }), InvoicesController.publicPreview);
router.get('/public/:token/pdf', validate({ params: publicTokenSchema }), InvoicesController.publicPdf);

router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', validate({ query: listInvoicesSchema }), InvoicesController.list);
router.get('/stats', InvoicesController.stats);
router.get('/templates', InvoicesController.templates);
router.get('/sequences', InvoicesController.sequences);
router.patch('/sequences', validate({ body: numberSequenceSchema }), InvoicesController.updateSequence);

router.post('/preview-totals', validate({ body: invoiceFields.pick({
  items: true, discountType: true, discountValue: true, shippingAmount: true,
  taxInclusive: true, isInterState: true, roundOffTotal: true,
}) }), InvoicesController.preview);

router.get('/:id', validate({ params: invoiceIdSchema }), InvoicesController.getById);
router.get('/:id/preview', validate({ params: invoiceIdSchema }), InvoicesController.previewHtml);
router.get('/:id/pdf', validate({ params: invoiceIdSchema }), InvoicesController.downloadPdf);

router.post(
  '/',
  validate({ body: createInvoiceSchema }),
  logActivity('invoice.create', 'Invoice'),
  InvoicesController.create,
);
router.patch(
  '/:id',
  validate({ params: invoiceIdSchema, body: updateInvoiceSchema }),
  logActivity('invoice.update', 'Invoice'),
  InvoicesController.update,
);
router.post(
  '/:id/email',
  validate({ params: invoiceIdSchema, body: emailInvoiceSchema }),
  logActivity('invoice.email', 'Invoice'),
  InvoicesController.emailToClient,
);
router.post(
  '/:id/send',
  validate({ params: invoiceIdSchema }),
  logActivity('invoice.send', 'Invoice'),
  InvoicesController.send,
);
router.patch(
  '/:id/status',
  validate({ params: invoiceIdSchema, body: changeStatusSchema }),
  logActivity('invoice.status', 'Invoice'),
  InvoicesController.changeStatus,
);
router.post(
  '/:id/duplicate',
  validate({ params: invoiceIdSchema, body: duplicateSchema }),
  InvoicesController.duplicate,
);
router.post(
  '/:id/cancel',
  validate({ params: invoiceIdSchema }),
  logActivity('invoice.cancel', 'Invoice'),
  InvoicesController.cancel,
);
router.delete(
  '/:id',
  validate({ params: invoiceIdSchema }),
  logActivity('invoice.delete', 'Invoice'),
  InvoicesController.remove,
);

router.post(
  '/:id/payments',
  validate({ params: invoiceIdSchema, body: recordPaymentSchema }),
  logActivity('invoice.payment.record', 'Invoice'),
  InvoicesController.recordPayment,
);
router.delete(
  '/:id/payments/:paymentId',
  validate({ params: paymentParams }),
  logActivity('invoice.payment.delete', 'Invoice'),
  InvoicesController.deletePayment,
);

export default router;
