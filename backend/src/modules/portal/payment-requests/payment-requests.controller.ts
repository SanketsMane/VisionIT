import fs from 'node:fs';
import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { resolvePrivatePath } from '@utils/private-storage';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import type { AuthedRequest } from '@/types/common.types';
import { PaymentRequestsService } from './payment-requests.service';
import type { SubmitPaymentDto } from './payment-requests.validation';

export const PaymentRequestsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    const { items, total, page, limit } = await PaymentRequestsService.listForProject(
      projectId,
      req.query as never,
    );
    return sendSuccess(res, items, 'Payment requests fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  /** Workspace-wide approvals queue. */
  queue: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { items, total, page, limit, summary } = await PaymentRequestsService.listForWorkspace(
      user.id,
      req.query as never,
    );
    return sendSuccess(res, items, 'Payment queue fetched', 200, {
      ...buildPaginationMeta(page, limit, total),
      summary,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    return sendSuccess(
      res,
      await PaymentRequestsService.getById(projectId, params.requestId),
      'Payment request fetched',
    );
  }),

  /**
   * Streams the proof file. Reached only through `requireProjectAccess`, so
   * membership is already verified — the file itself lives outside the public
   * static route and cannot be fetched by guessing a URL.
   */
  proof: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const proof = await PaymentRequestsService.loadProof(projectId, params.requestId);

    const absolute = resolvePrivatePath(proof.proofKey as string);
    if (!fs.existsSync(absolute)) throw ApiError.notFound('Payment proof file');

    res.setHeader('Content-Type', proof.proofMimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${(proof.proofFilename ?? 'proof').replace(/[^\w.-]/g, '_')}"`,
    );
    fs.createReadStream(absolute).pipe(res);
  }),

  submit: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const body = req.body as SubmitPaymentDto;

    const request = await PaymentRequestsService.submit(projectId, user.id, user.name, {
      invoiceId: body.invoiceId || null,
      amount: body.amount,
      paidAt: body.paidAt,
      method: body.method,
      reference: body.reference ?? null,
      reason: body.reason,
      notes: body.notes ?? null,
      proof: req.file,
    });

    return sendCreated(res, request, 'Payment submitted — it will show as verified once approved');
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const access = getProjectAccess(req);
    const data = await PaymentRequestsService.approve(
      access.projectId,
      params.requestId,
      { id: user.id, name: user.name, workspaceOwnerId: access.workspaceOwnerId },
      req.body,
    );
    return sendSuccess(res, data, 'Payment approved and posted to your ledger');
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await PaymentRequestsService.reject(
      projectId,
      params.requestId,
      { id: user.id, name: user.name },
      req.body.rejectionReason,
    );
    return sendSuccess(res, data, 'Payment rejected — the client has been told why');
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await PaymentRequestsService.cancel(projectId, params.requestId, user.id);
    return sendSuccess(res, data, 'Payment request withdrawn');
  }),
};

export default PaymentRequestsController;
