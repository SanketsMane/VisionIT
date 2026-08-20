import fs from 'node:fs';
import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { resolvePrivatePath } from '@utils/private-storage';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import type { AuthedRequest } from '@/types/common.types';
import { DeliveryService } from './delivery.service';
import { DELIVERY_STATUS_LABELS } from './delivery.constants';
import { ProjectDeliveryStatus, SourceCodeMethod } from '@prisma/client';

export const DeliveryController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await DeliveryService.get(projectId), 'Delivery fetched');
  }),

  readiness: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await DeliveryService.readiness(projectId), 'Delivery readiness checked');
  }),

  options: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(
      res,
      {
        statuses: Object.values(ProjectDeliveryStatus).map((value) => ({
          value,
          label: DELIVERY_STATUS_LABELS[value],
        })),
        sourceMethods: Object.values(SourceCodeMethod),
      },
      'Delivery options fetched',
    ),
  ),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.setStatus(projectId, req.body.status, {
      id: user.id,
      name: user.name,
    });
    return sendSuccess(res, data, 'Delivery status updated');
  }),

  toggleChecklist: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.toggleChecklistItem(
      projectId,
      params.itemId,
      req.body.isComplete,
      { id: user.id, name: user.name },
      req.body.note,
    );
    return sendSuccess(res, data, 'Checklist updated');
  }),

  chooseSourceMethod: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.chooseSourceMethod(projectId, req.body.method, {
      id: user.id,
      name: user.name,
    });
    return sendSuccess(res, data, 'Source-code preference saved');
  }),

  submitGithub: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.submitGithubDetails(
      projectId,
      { id: user.id, name: user.name },
      req.body,
    );
    return sendSuccess(res, data, 'GitHub details submitted');
  }),

  confirmGithubTransfer: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.confirmGithubTransfer(
      projectId,
      { id: user.id, name: user.name },
      req.body.notes,
    );
    return sendSuccess(res, data, 'Repository transfer recorded');
  }),

  uploadArchive: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    if (!req.file) throw ApiError.badRequest('No archive was uploaded');
    const data = await DeliveryService.uploadArchive(
      projectId,
      { id: user.id, name: user.name },
      req.file,
      (req.body as { version?: string }).version ?? 'v1.0.0',
    );
    return sendCreated(res, data, 'Source archive uploaded');
  }),

  /** Streams the source archive from private storage. */
  downloadArchive: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const delivery = await DeliveryService.prepareArchiveDownload(projectId, user.id);

    const absolute = resolvePrivatePath(delivery.zipStorageKey as string);
    if (!fs.existsSync(absolute)) throw ApiError.notFound('Archive file');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(delivery.zipFilename ?? 'source.zip').replace(/[^\w.-]/g, '_')}"`,
    );
    fs.createReadStream(absolute).pipe(res);
  }),

  publishVersion: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.publishVersion(
      projectId,
      { id: user.id, name: user.name },
      req.body,
    );
    return sendCreated(res, data, 'Version published');
  }),

  confirmAdmin: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.confirmAsAdmin(projectId, { id: user.id, name: user.name });
    return sendSuccess(res, data, 'Handover confirmed — waiting on the client');
  }),

  confirmClient: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await DeliveryService.confirmAsClient(projectId, { id: user.id, name: user.name });
    return sendSuccess(res, data, 'Thank you — receipt confirmed');
  }),

  handoverRecord: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await DeliveryService.handoverRecord(projectId), 'Handover record built');
  }),
};

export default DeliveryController;
