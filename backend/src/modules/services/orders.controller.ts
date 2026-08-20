import fs from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { resolvePrivatePath, storageKeyFor } from '@utils/private-storage';
import { prisma } from '@config/database';
import type { AuthedRequest } from '@/types/common.types';
import { OrdersService } from './orders.service';

/**
 * Confirms the caller owns the order before the upload middleware writes a
 * file. Multer streams to disk while parsing, so checking afterwards would mean
 * a stranger's bytes had already landed in the proof folder.
 */
export const requireOwnOrder = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const { user, params } = req as AuthedRequest;
    const order = await prisma.serviceOrder.findFirst({
      where: { id: params.id, clientUserId: user.id },
      select: { id: true },
    });
    if (!order) throw ApiError.notFound('Order');
    next();
  },
);

export const OrdersController = {
  // ── Client ───────────────────────────────────────────────────────────────

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendCreated(res, await OrdersService.create(user, req.body), 'Order placed');
  }),

  mine: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.listForClient(user.id), 'Orders fetched');
  }),

  mineById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.getForClient(user.id, params.id), 'Order fetched');
  }),

  paymentDetails: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(res, await OrdersService.paymentDetails(), 'Payment details fetched'),
  ),

  submitPayment: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const file = req.file;
    try {
      const data = await OrdersService.submitPayment(user, params.id, req.body, file
        ? {
            storageKey: storageKeyFor('order-proofs', params.id, file.filename),
            filename: file.originalname,
            mimeType: file.mimetype,
          }
        : undefined);
      return sendSuccess(res, data, 'Payment submitted — we will verify it shortly');
    } catch (error) {
      // The row never took the file, so the bytes on disk are litter.
      if (file) fs.promises.unlink(file.path).catch(() => undefined);
      throw error;
    }
  }),

  // ── Studio ───────────────────────────────────────────────────────────────

  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { status } = req.query as unknown as { status?: never };
    return sendSuccess(res, await OrdersService.listForStudio(user.id, { status }), 'Orders fetched');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.getForStudio(user.id, params.id), 'Order fetched');
  }),

  setPrice: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await OrdersService.setPrice(user.id, params.id, req.body.price, req.body.note);
    return sendSuccess(res, data, 'Quote sent to the client');
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.approve(user.id, params.id, req.body), 'Order activated');
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.reject(user.id, params.id, req.body.reason), 'Payment rejected');
  }),

  credentials: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.credentials(user.id, params.id), 'Credentials fetched');
  }),

  notes: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    await OrdersService.updateNotes(user.id, params.id, req.body.internalNotes ?? null);
    return sendSuccess(res, null, 'Notes saved');
  }),

  /** Streams the payment proof to whichever side legitimately owns the order. */
  proof: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const isInternal = user.userType === 'INTERNAL';
    const order = await prisma.serviceOrder.findFirst({
      where: isInternal ? { id: params.id, userId: user.id } : { id: params.id, clientUserId: user.id },
      select: { proofKey: true, proofFilename: true, proofMimeType: true },
    });
    if (!order?.proofKey) throw ApiError.notFound('Proof');

    const absolute = resolvePrivatePath(order.proofKey);
    if (!fs.existsSync(absolute)) throw ApiError.notFound('File');

    res.setHeader('Content-Type', order.proofMimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(order.proofFilename ?? 'proof')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(absolute).pipe(res);
  }),

  // ── Help thread (both sides) ─────────────────────────────────────────────

  messages: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    return sendSuccess(res, await OrdersService.messages(user, params.id), 'Messages fetched');
  }),

  addMessage: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const data = await OrdersService.addMessage(user, params.id, req.body.body, req.body.isInternal);
    return sendCreated(res, data, 'Message sent');
  }),
};

export default OrdersController;
