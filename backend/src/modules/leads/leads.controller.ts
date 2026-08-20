import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { asyncHandler } from '@utils/async-handler';
import type { AuthedRequest } from '@/types/common.types';
import { LeadsService } from './leads.service';

const ownerOf = (req: Request): string => (req as AuthedRequest).user.id;

const sessionContext = (req: Request) => ({
  userAgent: req.get('user-agent') ?? undefined,
  ipAddress: req.ip,
});

export const LeadsController = {
  /**
   * Public sign-up. Always creates a LEAD — see `LeadsService.register`.
   *
   * A filled honeypot returns the same 201 a real sign-up gets. Answering 422
   * would confirm the trap and tell the author exactly which field to leave
   * alone next time.
   */
  register: asyncHandler(async (req: Request, res: Response) => {
    if (req.body.website) {
      return sendCreated(
        res,
        { user: null },
        'Account created. Check your email to get started.',
      );
    }

    const result = await LeadsService.register(req.body, sessionContext(req));

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return sendCreated(
      res,
      {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      },
      `Welcome, ${result.user.name.split(' ')[0]}`,
    );
  }),

  contact: asyncHandler(async (req: Request, res: Response) => {
    if (req.body.website) {
      return sendSuccess(res, { id: null }, 'Thanks — we will be in touch.', StatusCodes.CREATED);
    }
    const userId = (req as Partial<AuthedRequest>).user?.id ?? null;
    const result = await LeadsService.contact(req.body, userId);
    return sendSuccess(res, result, 'Thanks — we will be in touch.', StatusCodes.CREATED);
  }),

  // ---- Studio ---------------------------------------------------------------

  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await LeadsService.list(ownerOf(req), req.query as never);
    return sendSuccess(res, data);
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const data = await LeadsService.stats(ownerOf(req));
    return sendSuccess(res, data);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const lead = await LeadsService.getById(ownerOf(req), String(req.params.id));
    return sendSuccess(res, lead);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const lead = await LeadsService.update(ownerOf(req), String(req.params.id), req.body);
    return sendSuccess(res, lead, 'Lead updated');
  }),

  enquiries: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 25);
    const data = await LeadsService.listEnquiries(ownerOf(req), page, limit);
    return sendSuccess(res, data);
  }),

  markEnquiryRead: asyncHandler(async (req: Request, res: Response) => {
    const result = await LeadsService.markEnquiryRead(ownerOf(req), String(req.params.id));
    return sendSuccess(res, result, 'Marked as read');
  }),
};
