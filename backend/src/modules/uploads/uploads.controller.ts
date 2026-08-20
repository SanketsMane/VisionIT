import path from 'node:path';
import type { Request, Response } from 'express';
import { prisma } from '@config/database';
import { asyncHandler } from '@utils/async-handler';
import { sendCreated, sendSuccess } from '@utils/api-response';
import { ApiError } from '@utils/api-error';
import { publicUrlFor, removeStoredFile } from '@middlewares/upload.middleware';
import type { AuthedRequest } from '@/types/common.types';

/** Persists an uploaded file's metadata and returns its public URL. */
const persist = async (
  userId: string,
  file: Express.Multer.File,
  ownerType?: string,
  ownerId?: string,
) => {
  const url = publicUrlFor(userId, file.filename);
  return prisma.fileAsset.create({
    data: {
      userId,
      key: `${userId}/${file.filename}`,
      url,
      filename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      ownerType: ownerType ?? null,
      ownerId: ownerId ?? null,
    },
  });
};

export const UploadsController = {
  single: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    if (!req.file) throw ApiError.badRequest('No file was uploaded');
    const { ownerType, ownerId } = req.body as { ownerType?: string; ownerId?: string };
    return sendCreated(res, await persist(user.id, req.file, ownerType, ownerId), 'File uploaded');
  }),

  multiple: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw ApiError.badRequest('No files were uploaded');

    const { ownerType, ownerId } = req.body as { ownerType?: string; ownerId?: string };
    const assets = [];
    for (const file of files) assets.push(await persist(user.id, file, ownerType, ownerId));

    return sendCreated(res, assets, `${assets.length} file(s) uploaded`);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { user } = req as AuthedRequest;
    const { ownerType, ownerId } = req.query as { ownerType?: string; ownerId?: string };
    const assets = await prisma.fileAsset.findMany({
      where: {
        userId: user.id,
        ...(ownerType ? { ownerType } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return sendSuccess(res, assets, 'Files fetched');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { user, params } = req as AuthedRequest;
    const asset = await prisma.fileAsset.findFirst({ where: { id: params.id, userId: user.id } });
    if (!asset) throw ApiError.notFound('File');

    // Remove the row first — an orphaned file on disk is far less harmful
    // than a database row pointing at a file that no longer exists.
    await prisma.fileAsset.delete({ where: { id: asset.id } });
    removeStoredFile(user.id, path.basename(asset.key));

    return sendSuccess(res, null, 'File deleted');
  }),
};

export default UploadsController;
