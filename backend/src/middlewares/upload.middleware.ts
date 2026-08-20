import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';
import { env } from '@config/env';
import { ApiError } from '@utils/api-error';

export const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

const ensureDir = (dir: string): string => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

ensureDir(UPLOAD_ROOT);

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
];

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    // One folder per user keeps assets isolated and easy to purge on delete.
    const folder = ensureDir(path.join(UPLOAD_ROOT, req.user?.id ?? 'anonymous'));
    cb(null, folder);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
  },
});

const makeFilter =
  (allowed: string[]) =>
  (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };

export const uploadImage = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: makeFilter(IMAGE_TYPES),
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: makeFilter([...IMAGE_TYPES, ...DOC_TYPES]),
});

/** Public URL for a stored file, used when persisting `FileAsset.url`. */
export const publicUrlFor = (userId: string, filename: string): string =>
  `${env.PUBLIC_BASE_URL}/${env.UPLOAD_DIR}/${userId}/${filename}`;

export const removeStoredFile = (userId: string, filename: string): void => {
  const target = path.join(UPLOAD_ROOT, userId, path.basename(filename));
  if (fs.existsSync(target)) fs.unlinkSync(target);
};
