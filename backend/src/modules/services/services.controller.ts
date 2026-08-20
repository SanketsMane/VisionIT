import type { Request, Response } from 'express';
import { prisma } from '@config/database';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import type { AuthedRequest } from '@/types/common.types';
import { ServicesService } from './services.service';
import { CouponsService } from './coupons.service';

/**
 * The public catalog belongs to the studio that owns the deployment.
 *
 * There is exactly one internal workspace per install, so rather than putting a
 * workspace id in a public URL — which would be both ugly and enumerable — the
 * owner is resolved once from the database and cached for the process.
 */
let cachedOwnerId: string | null = null;
const resolveOwner = async (): Promise<string> => {
  if (cachedOwnerId) return cachedOwnerId;
  const owner = await prisma.user.findFirst({
    where: { userType: 'INTERNAL', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!owner) throw ApiError.notFound('Catalog');
  cachedOwnerId = owner.id;
  return owner.id;
};

export const ServicesController = {
  // ── Public ───────────────────────────────────────────────────────────────

  publicCatalog: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, await ServicesService.publicCatalog(await resolveOwner()), 'Services fetched'),
  ),

  publicService: asyncHandler(async (req: Request, res: Response) =>
    sendSuccess(
      res,
      await ServicesService.getBySlug(await resolveOwner(), String(req.params.slug)),
      'Service fetched',
    ),
  ),

  previewCoupon: asyncHandler(async (req: Request, res: Response) =>
    sendSuccess(
      res,
      await CouponsService.preview(await resolveOwner(), req.body.code, req.body.serviceId),
      'Coupon applied',
    ),
  ),

  submitQuote: asyncHandler(async (req: Request, res: Response) => {
    // The honeypot is invisible to people; anything in it came from a bot. It
    // is accepted with a normal-looking response so the bot learns nothing.
    if (req.body.website) return sendCreated(res, { id: null }, 'Thanks — we will be in touch');

    const signedIn = (req as Partial<AuthedRequest>).user;
    const data = await ServicesService.submitQuote(await resolveOwner(), req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      requestedById: signedIn?.id,
      source: signedIn ? 'portal' : 'public',
    });
    return sendCreated(res, data, 'Thanks — we will be in touch shortly');
  }),

  // ── Studio ───────────────────────────────────────────────────────────────

  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { category, includeInactive } = req.query as unknown as {
      category?: never; includeInactive?: boolean;
    };
    return sendSuccess(res, await ServicesService.list(user.id, { category, includeInactive }), 'Services fetched');
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await ServicesService.stats(user.id), 'Service stats fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ServicesService.getById(user.id, params.id), 'Service fetched');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await ServicesService.create(user.id, req.body), 'Service created');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ServicesService.update(user.id, params.id, req.body), 'Service updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await ServicesService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Service removed');
  }),

  reorder: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    await ServicesService.reorder(user.id, req.body.items);
    return sendSuccess(res, null, 'Order saved');
  }),

  // ── Quotes ───────────────────────────────────────────────────────────────

  listQuotes: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const query = req.query as unknown as { status?: never; search?: string; page: number; limit: number };
    const { items, total, page, limit, byStatus } = await ServicesService.listQuotes(user.id, query);
    return sendSuccess(res, { items, byStatus }, 'Enquiries fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  getQuote: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ServicesService.getQuote(user.id, params.id), 'Enquiry fetched');
  }),

  updateQuote: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await ServicesService.updateQuote(user.id, params.id, req.body), 'Enquiry updated');
  }),

  // ── Coupons ──────────────────────────────────────────────────────────────

  listCoupons: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await CouponsService.list(user.id), 'Coupons fetched');
  }),

  createCoupon: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await CouponsService.create(user.id, req.body), 'Coupon created');
  }),

  updateCoupon: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await CouponsService.update(user.id, params.id, req.body), 'Coupon updated');
  }),

  removeCoupon: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await CouponsService.remove(user.id, params.id);
    return sendSuccess(res, null, 'Coupon removed');
  }),
};

export default ServicesController;
