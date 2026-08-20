import fs from 'node:fs';
import type { Request, Response } from 'express';
import { asyncHandler } from '@utils/async-handler';
import { buildPaginationMeta, sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { resolvePrivatePath } from '@utils/private-storage';
import { getProjectAccess } from '@middlewares/project-access.middleware';
import { roleCan } from '@modules/portal/portal.permissions';
import type { AuthedRequest } from '@/types/common.types';
import { BugsService } from './bugs.service';
import { STATUS_LABELS } from './bugs.lifecycle';
import type { CreateBugDto } from './bugs.validation';
import { BugPriority, BugSeverity, BugStatus } from '@prisma/client';

export const BugsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    const { items, total, page, limit } = await BugsService.list(projectId, req.query as never);
    return sendSuccess(res, items, 'Issues fetched', 200, buildPaginationMeta(page, limit, total));
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await BugsService.stats(projectId), 'Testing stats fetched');
  }),

  modules: asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = getProjectAccess(req);
    return sendSuccess(res, await BugsService.modules(projectId), 'Modules fetched');
  }),

  /** Static reference data for the report form and filters. */
  options: asyncHandler(async (_req: Request, res: Response) =>
    sendSuccess(
      res,
      {
        priorities: Object.values(BugPriority),
        severities: Object.values(BugSeverity),
        statuses: Object.values(BugStatus).map((value) => ({ value, label: STATUS_LABELS[value] })),
      },
      'Issue options fetched',
    ),
  ),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const access = getProjectAccess(req);
    // Internal-only content is included solely for roles that may see it.
    const includeInternal = roleCan(access.role, 'bug:internal');
    return sendSuccess(
      res,
      await BugsService.getById(access.projectId, params.bugId, includeInternal),
      'Issue fetched',
    );
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const body = req.body as CreateBugDto;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    const bug = await BugsService.create(
      projectId,
      { id: user.id, name: user.name },
      {
        title: body.title,
        description: body.description,
        expectedBehavior: body.expectedBehavior ?? null,
        actualBehavior: body.actualBehavior ?? null,
        stepsToReproduce: body.stepsToReproduce ?? null,
        priority: body.priority,
        severity: body.severity,
        module: body.module ?? null,
        environment: body.environment ?? null,
        browser: body.browser ?? null,
        device: body.device ?? null,
        os: body.os ?? null,
        url: body.url ?? null,
      },
      files,
    );

    return sendCreated(res, bug, 'Issue reported');
  }),

  changeStatus: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const access = getProjectAccess(req);
    const data = await BugsService.changeStatus(
      access.projectId,
      params.bugId,
      req.body.status,
      { id: user.id, name: user.name, isInternal: access.isInternal },
      { reason: req.body.reason, duplicateOfId: req.body.duplicateOfId },
    );
    return sendSuccess(res, data, 'Issue updated');
  }),

  acknowledge: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await BugsService.acknowledge(
      projectId,
      params.bugId,
      { id: user.id, name: user.name },
      req.body,
    );
    return sendSuccess(res, data, 'Issue acknowledged');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const data = await BugsService.update(
      projectId,
      params.bugId,
      { id: user.id, name: user.name },
      req.body,
    );
    return sendSuccess(res, data, 'Issue updated');
  }),

  comment: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const access = getProjectAccess(req);
    const data = await BugsService.comment(
      access.projectId,
      params.bugId,
      { id: user.id, name: user.name, isInternal: access.isInternal },
      req.body.body,
      req.body.isInternal,
    );
    return sendCreated(res, data, 'Comment added');
  }),

  addAttachments: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const data = await BugsService.addAttachments(projectId, params.bugId, user.id, files);
    return sendCreated(res, data, 'Attachment added');
  }),

  /** Streams a private attachment after membership has been verified. */
  attachment: asyncHandler(async (req: Request, res: Response) => {
    const { params } = req as AuthedRequest;
    const { projectId } = getProjectAccess(req);
    const attachment = await BugsService.loadAttachment(projectId, params.bugId, params.attachmentId);

    const absolute = resolvePrivatePath(attachment.storageKey);
    if (!fs.existsSync(absolute)) throw ApiError.notFound('Attachment file');

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.filename.replace(/[^\w.-]/g, '_')}"`,
    );
    fs.createReadStream(absolute).pipe(res);
  }),
};

export default BugsController;
