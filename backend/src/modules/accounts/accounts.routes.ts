import { Router } from 'express';
import { authenticate, authorize, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { AccountsController } from './accounts.controller';
import {
  accountIdSchema,
  accountLedgerSchema,
  createAccountSchema,
  listAccountsSchema,
  transferSchema,
  updateAccountSchema,
} from './accounts.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

router.get('/', validate({ query: listAccountsSchema }), AccountsController.list);
router.get('/template', AccountsController.template);
router.get('/cash-position', AccountsController.cashPosition);
router.get('/:id', validate({ params: accountIdSchema }), AccountsController.getById);
router.get(
  '/:id/ledger',
  validate({ params: accountIdSchema, query: accountLedgerSchema }),
  AccountsController.ledger,
);

router.post(
  '/',
  authorize('OWNER', 'ADMIN', 'ACCOUNTANT'),
  validate({ body: createAccountSchema }),
  logActivity('account.create', 'Account'),
  AccountsController.create,
);
router.post(
  '/transfer',
  authorize('OWNER', 'ADMIN', 'ACCOUNTANT'),
  validate({ body: transferSchema }),
  logActivity('account.transfer', 'Account'),
  AccountsController.transfer,
);
router.patch(
  '/:id',
  authorize('OWNER', 'ADMIN', 'ACCOUNTANT'),
  validate({ params: accountIdSchema, body: updateAccountSchema }),
  logActivity('account.update', 'Account'),
  AccountsController.update,
);
router.delete(
  '/:id',
  authorize('OWNER', 'ADMIN'),
  validate({ params: accountIdSchema }),
  logActivity('account.delete', 'Account'),
  AccountsController.remove,
);

export default router;
