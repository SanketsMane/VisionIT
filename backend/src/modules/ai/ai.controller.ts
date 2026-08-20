import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendSuccess } from '@utils/api-response';
import { dayjs } from '@utils/date.util';
import type { AuthedRequest } from '@/types/common.types';
import { AiService } from './ai.service';
import { PURPOSE_GUIDANCE, TONE_GUIDANCE } from './ai.prompts';

export const AiController = {
  generateEmail: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await AiService.generateEmail(user.id, req.body), 'Email drafted');
  }),

  improveEmail: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await AiService.improveEmail(user.id, req.body), 'Draft rewritten');
  }),

  suggestSubjects: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { bodyHtml, purpose } = req.body;
    return sendSuccess(res, await AiService.suggestSubjects(user.id, bodyHtml, purpose), 'Subject lines suggested');
  }),

  /** Powers the tone/purpose pickers in the email composer. */
  options: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(
      res,
      {
        tones: Object.entries(TONE_GUIDANCE).map(([value, description]) => ({ value, description })),
        purposes: Object.entries(PURPOSE_GUIDANCE).map(([value, description]) => ({ value, description })),
        lengths: [
          { value: 'short', description: '60–90 words, two paragraphs' },
          { value: 'medium', description: '120–180 words, three paragraphs' },
          { value: 'detailed', description: '220–300 words, may include a list' },
        ],
      },
      'AI options fetched',
    ),
  ),

  history: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { items, total } = await AiService.history(user.id, page, limit);
    return sendSuccess(res, items, 'AI history fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  usage: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { from, to } = req.query as { from?: Date; to?: Date };
    return sendSuccess(
      res,
      await AiService.usage(
        user.id,
        from ?? dayjs.utc().startOf('month').toDate(),
        to ?? dayjs.utc().endOf('day').toDate(),
      ),
      'AI usage fetched',
    );
  }),
};

export default AiController;
