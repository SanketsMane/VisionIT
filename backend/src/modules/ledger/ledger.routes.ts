import { Router } from 'express';
import { authenticate, authorize, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { LedgerController } from './ledger.controller';
import { createEntrySchema, entryIdSchema, listEntriesSchema, trialBalanceSchema } from './ledger.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', validate({ query: listEntriesSchema }), LedgerController.list);
router.get('/trial-balance', validate({ query: trialBalanceSchema }), LedgerController.trialBalance);
router.get('/:id', validate({ params: entryIdSchema }), LedgerController.getById);

router.post(
  '/',
  authorize('OWNER', 'ADMIN', 'ACCOUNTANT'),
  validate({ body: createEntrySchema }),
  logActivity('ledger.entry.create', 'JournalEntry'),
  LedgerController.create,
);
router.post(
  '/:id/void',
  authorize('OWNER', 'ADMIN', 'ACCOUNTANT'),
  validate({ params: entryIdSchema }),
  logActivity('ledger.entry.void', 'JournalEntry'),
  LedgerController.void,
);

export default router;
