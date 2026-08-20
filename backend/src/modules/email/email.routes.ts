import { Router } from 'express';
import { authenticate, emailSendLimiter, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { EmailController } from './email.controller';
import {
  composeEmailSchema,
  emailAccountSchema,
  emailIdSchema,
  listEmailsSchema,
  renderTemplateSchema,
  templateSchema,
  updateDraftSchema,
  updateEmailAccountSchema,
} from './email.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

// ---- Mailboxes ------------------------------------------------------------
router.get('/accounts', EmailController.listAccounts);
router.post('/accounts', validate({ body: emailAccountSchema }), EmailController.createAccount);
router.patch(
  '/accounts/:id',
  validate({ params: emailIdSchema, body: updateEmailAccountSchema }),
  EmailController.updateAccount,
);
router.delete('/accounts/:id', validate({ params: emailIdSchema }), EmailController.removeAccount);
router.post('/accounts/:id/verify', validate({ params: emailIdSchema }), EmailController.verifyAccount);

// ---- Templates ------------------------------------------------------------
router.get('/templates', EmailController.listTemplates);
router.post('/templates', validate({ body: templateSchema }), EmailController.createTemplate);
router.patch(
  '/templates/:id',
  validate({ params: emailIdSchema, body: templateSchema.partial() }),
  EmailController.updateTemplate,
);
router.delete('/templates/:id', validate({ params: emailIdSchema }), EmailController.removeTemplate);
router.post(
  '/templates/:id/render',
  validate({ params: emailIdSchema, body: renderTemplateSchema }),
  EmailController.renderTemplate,
);

// ---- Messages -------------------------------------------------------------
router.get('/merge-fields', EmailController.mergeFields);
router.get('/stats', EmailController.stats);
router.get('/', validate({ query: listEmailsSchema }), EmailController.list);
router.get('/:id', validate({ params: emailIdSchema }), EmailController.getById);

router.post('/drafts', validate({ body: composeEmailSchema }), EmailController.createDraft);
router.patch(
  '/:id',
  validate({ params: emailIdSchema, body: updateDraftSchema }),
  EmailController.updateDraft,
);
router.delete('/:id', validate({ params: emailIdSchema }), EmailController.remove);

router.post(
  '/send',
  emailSendLimiter,
  validate({ body: composeEmailSchema }),
  logActivity('email.send', 'EmailMessage'),
  EmailController.composeAndSend,
);
router.post(
  '/:id/send',
  emailSendLimiter,
  validate({ params: emailIdSchema }),
  logActivity('email.send', 'EmailMessage'),
  EmailController.send,
);

export default router;
