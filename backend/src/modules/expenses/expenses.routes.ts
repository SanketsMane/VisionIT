import { Router } from 'express';
import { z } from 'zod';
import { authenticate, logActivity, validate } from '@middlewares/index';
import { requireInternal } from '@middlewares/project-access.middleware';
import { ExpensesController } from './expenses.controller';
import {
  categorySchema,
  createExpenseSchema,
  expenseIdSchema,
  listExpensesSchema,
  updateExpenseSchema,
} from './expenses.validation';

const router = Router();
router.use(authenticate);
// Studio surface — client-portal users must never reach it.
router.use(requireInternal);

const rangeSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

router.get('/categories', ExpensesController.listCategories);
router.post('/categories', validate({ body: categorySchema }), ExpensesController.createCategory);
router.patch(
  '/categories/:id',
  validate({ params: expenseIdSchema, body: categorySchema.partial() }),
  ExpensesController.updateCategory,
);
router.delete('/categories/:id', validate({ params: expenseIdSchema }), ExpensesController.removeCategory);

router.get('/', validate({ query: listExpensesSchema }), ExpensesController.list);
router.get('/stats', validate({ query: rangeSchema }), ExpensesController.stats);
router.get('/:id', validate({ params: expenseIdSchema }), ExpensesController.getById);

router.post(
  '/',
  validate({ body: createExpenseSchema }),
  logActivity('expense.create', 'Expense'),
  ExpensesController.create,
);
router.patch(
  '/:id',
  validate({ params: expenseIdSchema, body: updateExpenseSchema }),
  logActivity('expense.update', 'Expense'),
  ExpensesController.update,
);
router.delete(
  '/:id',
  validate({ params: expenseIdSchema }),
  logActivity('expense.delete', 'Expense'),
  ExpensesController.remove,
);

export default router;
