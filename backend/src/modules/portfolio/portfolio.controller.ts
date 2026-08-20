import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import type { AuthedRequest } from '@/types/common.types';
import { PortfolioService } from './portfolio.service';

/** The workspace whose data an internal caller acts on. */
const ownerOf = (req: Request): string => (req as AuthedRequest).user.id;

export const PortfolioController = {
  // ---- Public (no session) --------------------------------------------------

  publicCatalog: asyncHandler(async (req: Request, res: Response) => {
    const data = await PortfolioService.publicCatalog(req.query.category as never);
    return sendSuccess(res, data);
  }),

  publicItem: asyncHandler(async (req: Request, res: Response) => {
    const item = await PortfolioService.publicItem(String(req.params.slug));
    return sendSuccess(res, item);
  }),

  // ---- Studio ---------------------------------------------------------------

  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await PortfolioService.list(ownerOf(req), req.query as never);
    return sendSuccess(res, data);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const item = await PortfolioService.getById(ownerOf(req), String(req.params.id));
    return sendSuccess(res, item);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const item = await PortfolioService.create(ownerOf(req), req.body);
    return sendCreated(res, item, 'Added to your portfolio');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const item = await PortfolioService.update(ownerOf(req), String(req.params.id), req.body);
    return sendSuccess(res, item, 'Portfolio updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await PortfolioService.remove(ownerOf(req), String(req.params.id));
    return sendSuccess(res, result, 'Removed from your portfolio');
  }),

  draftFromProject: asyncHandler(async (req: Request, res: Response) => {
    const draft = await PortfolioService.draftFromProject(ownerOf(req), String(req.params.id));
    return sendSuccess(res, draft);
  }),
};
