import { ProjectDeliveryStatus, SourceCodeMethod } from '@prisma/client';
import { z } from 'zod';

export const checklistItemParam = z.object({
  projectId: z.string().min(1),
  itemId: z.string().min(1),
});

export const setStatusSchema = z.object({
  status: z.nativeEnum(ProjectDeliveryStatus),
});

export const checklistToggleSchema = z.object({
  isComplete: z.boolean(),
  note: z.string().trim().max(500).optional().nullable(),
});

export const sourceMethodSchema = z.object({
  method: z.nativeEnum(SourceCodeMethod),
});

export const githubDetailsSchema = z.object({
  githubUsername: z
    .string()
    .trim()
    .min(1, 'Enter your GitHub username or organisation')
    .max(80)
    .regex(/^[A-Za-z0-9-]+$/, 'GitHub usernames contain only letters, numbers and dashes'),
  githubRepoUrl: z
    .string()
    .trim()
    .url('Enter the full repository URL')
    .refine((value) => /github\.com/i.test(value), 'That does not look like a GitHub URL'),
});

export const confirmTransferSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const publishVersionSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, 'Enter a version')
    .max(40)
    .regex(/^[A-Za-z0-9.\-_]+$/, 'Use something like v1.0.0'),
  releaseNotes: z.string().trim().max(8000).optional().nullable(),
});

/** Multipart — the archive rides along with the version label. */
export const uploadArchiveSchema = z.object({
  version: z.string().trim().min(1, 'Enter a version').max(40),
});
