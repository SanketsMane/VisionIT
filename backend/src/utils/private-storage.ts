import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { env } from '@config/env';
import { ApiError } from './api-error';

/**
 * Private file storage.
 *
 * Payment proofs, project documents and source-code archives must never be
 * reachable by guessing a URL, so they live outside `uploads/` (which Express
 * serves statically) and are streamed only through authorised endpoints that
 * check project membership first.
 */
export const PRIVATE_ROOT = path.resolve(process.cwd(), 'storage', 'private');

const ensureDir = (dir: string): string => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
};

ensureDir(PRIVATE_ROOT);

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'text/markdown',
];
const ARCHIVE_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-tar',
  'application/x-7z-compressed',
];

/**
 * Builds a storage key. The random segment means a leaked filename cannot be
 * used to guess sibling files, and `path.basename` strips any traversal the
 * client tried to smuggle into the original name.
 */
const buildKey = (scope: string, projectId: string, originalName: string): string => {
  const ext = path.extname(path.basename(originalName)).toLowerCase().slice(0, 12);
  const random = crypto.randomBytes(12).toString('hex');
  return path.join(scope, projectId, `${Date.now()}-${random}${ext}`);
};

const makeStorage = (scope: string) =>
  multer.diskStorage({
    destination: (req: Request, _file, cb) => {
      const projectId = (req.params.projectId ?? req.params.id ?? 'misc') as string;
      // Reject anything that isn't a plain id before it becomes a path segment.
      if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
        return cb(ApiError.badRequest('Invalid project reference'), '');
      }
      cb(null, ensureDir(path.join(PRIVATE_ROOT, scope, projectId)));
    },
    filename: (req: Request, file, cb) => {
      const projectId = (req.params.projectId ?? req.params.id ?? 'misc') as string;
      cb(null, path.basename(buildKey(scope, projectId, file.originalname)));
    },
  });

const makeFilter =
  (allowed: string[]) =>
  (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  };

/** Payment proof — a screenshot or a PDF receipt. */
export const uploadPaymentProof = multer({
  storage: makeStorage('payment-proofs'),
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: makeFilter([...IMAGE_TYPES, 'application/pdf']),
});

/** Bug attachments — screenshots and short screen recordings. */
export const uploadBugAttachment = multer({
  storage: makeStorage('bug-attachments'),
  limits: { fileSize: env.maxUploadBytes * 5, files: 5 },
  fileFilter: makeFilter([...IMAGE_TYPES, ...VIDEO_TYPES, 'application/pdf']),
});

/** Project documents — contracts, specs, reports. */
export const uploadProjectDocument = multer({
  storage: makeStorage('documents'),
  limits: { fileSize: env.maxUploadBytes * 10 },
  fileFilter: makeFilter([...DOC_TYPES, ...IMAGE_TYPES, ...ARCHIVE_TYPES]),
});

/** Source-code archives, which are legitimately large. */
export const uploadSourceArchive = multer({
  storage: makeStorage('source-code'),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: makeFilter(ARCHIVE_TYPES),
});

export const storageKeyFor = (scope: string, projectId: string, filename: string): string =>
  path.posix.join(scope, projectId, filename);

/**
 * Resolves a storage key to an absolute path, refusing anything that escapes
 * the private root. Without this check a crafted key like `../../.env` would
 * read arbitrary files through the download endpoint.
 */
export const resolvePrivatePath = (storageKey: string): string => {
  const resolved = path.resolve(PRIVATE_ROOT, storageKey);
  const root = path.resolve(PRIVATE_ROOT);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw ApiError.badRequest('Invalid file reference');
  }
  return resolved;
};

export const privateFileExists = (storageKey: string): boolean =>
  fs.existsSync(resolvePrivatePath(storageKey));

export const removePrivateFile = (storageKey: string): void => {
  const target = resolvePrivatePath(storageKey);
  if (fs.existsSync(target)) fs.unlinkSync(target);
};

export const privateFileSize = (storageKey: string): number => {
  const target = resolvePrivatePath(storageKey);
  return fs.existsSync(target) ? fs.statSync(target).size : 0;
};

/**
 * SHA-256 of a stored file. Recorded on source-code handovers so the client can
 * verify the archive they downloaded is byte-for-byte what was delivered.
 */
export const checksumPrivateFile = async (storageKey: string): Promise<string> => {
  const target = resolvePrivatePath(storageKey);
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(target);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};
