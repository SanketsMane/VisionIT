import { DocumentCategory, DocumentVisibility } from '@prisma/client';
import { z } from 'zod';

export const documentIdParam = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
});

export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  category: z.nativeEnum(DocumentCategory).optional(),
  search: z.string().trim().max(120).optional(),
});

/** Multipart upload — booleans arrive as the strings "true"/"false". */
export const uploadDocumentSchema = z.object({
  name: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.nativeEnum(DocumentCategory).default(DocumentCategory.OTHER),
  version: z.string().trim().max(40).optional().nullable(),
  visibility: z.nativeEnum(DocumentVisibility).default(DocumentVisibility.ADMIN_ONLY),
  allowDownload: z.coerce.boolean().default(true),
});

export const updateDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.nativeEnum(DocumentCategory).optional(),
  version: z.string().trim().max(40).optional().nullable(),
  visibility: z.nativeEnum(DocumentVisibility).optional(),
  allowDownload: z.boolean().optional(),
});

export type UploadDocumentDto = z.infer<typeof uploadDocumentSchema>;
