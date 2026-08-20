import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendCreated, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { ExpensesService } from './expenses.service';

export const ExpensesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit, summary } = await ExpensesService.list(user.id, req.query as never);
    return sendSuccess(res, items, 'Expenses fetched', 200, {
      ...buildPaginationMeta(page, limit, total),
      summary,
    });
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { from, to } = req.query as { from?: Date; to?: Date };
    return sendSuccess(res, await ExpensesService.stats(user.id, { from, to }), 'Expense stats fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ExpensesService.getById(user.id, params.id), 'Expense fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await ExpensesService.create(user.id, req.body), 'Expense recorded and posted to your ledger');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ExpensesService.update(user.id, params.id, req.body), 'Expense updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ExpensesService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Expense deleted and ledger entry reversed');
  }),

  listCategories: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await ExpensesService.listCategories(user.id), 'Categories fetched');
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await ExpensesService.createCategory(user.id, req.body), 'Category created');
  }),

  updateCategory: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ExpensesService.updateCategory(user.id, params.id, req.body), 'Category updated');
  }),

  removeCategory: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ExpensesService.removeCategory(user.id, params.id);
    return sendSuccess(res, null, 'Category deleted');
  }),
};

export default ExpensesController;
