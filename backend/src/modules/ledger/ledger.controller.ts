import type { Request, Response } from 'express';
import { JournalSource } from '@prisma/client';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendPaginated, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { LedgerService } from './ledger.service';

export const LedgerController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit } = await LedgerService.list(user.id, req.query as never);
    return sendPaginated(res, items, { page, limit, total }, 'Journal entries fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await LedgerService.getById(user.id, params.id), 'Journal entry fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const entry = await LedgerService.createEntry(user.id, {
      ...req.body,
      source: JournalSource.MANUAL,
    });
    return sendCreated(res, entry, 'Journal entry posted');
  }),

  void: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await LedgerService.voidEntry(user.id, params.id), 'Journal entry voided');
  }),

  trialBalance: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const asOf = (req.query as { asOf?: Date }).asOf ?? new Date();
    return sendSuccess(res, await LedgerService.trialBalance(user.id, asOf), 'Trial balance generated');
  }),
};

export default LedgerController;
