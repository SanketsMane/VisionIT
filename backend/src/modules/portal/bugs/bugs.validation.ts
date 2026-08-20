import { BugPriority, BugSeverity, BugStatus } from '@prisma/client';
import { z } from 'zod';

export const bugIdParam = z.object({
  projectId: z.string().min(1),
  bugId: z.string().min(1),
});

export const attachmentParam = z.object({
  projectId: z.string().min(1),
  bugId: z.string().min(1),
  attachmentId: z.string().min(1),
});

export const listBugsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(BugStatus).optional(),
  priority: z.nativeEnum(BugPriority).optional(),
  severity: z.nativeEnum(BugSeverity).optional(),
  module: z.string().trim().max(80).optional(),
  assignedToUserId: z.string().min(1).optional(),
  reportedByUserId: z.string().min(1).optional(),
  openOnly: z.coerce.boolean().optional(),
});

/** Multipart — attachments ride along with the report, so scalars are coerced. */
export const createBugSchema = z.object({
  title: z.string().trim().min(4, 'Give the issue a short, specific title').max(200),
  description: z.string().trim().min(10, 'Describe what happened').max(10000),
  expectedBehavior: z.string().trim().max(4000).optional().nullable(),
  actualBehavior: z.string().trim().max(4000).optional().nullable(),
  stepsToReproduce: z.string().trim().max(6000).optional().nullable(),
  priority: z.nativeEnum(BugPriority).default(BugPriority.MEDIUM),
  severity: z.nativeEnum(BugSeverity).default(BugSeverity.MAJOR),
  module: z.string().trim().max(80).optional().nullable(),
  environment: z.string().trim().max(120).optional().nullable(),
  browser: z.string().trim().max(80).optional().nullable(),
  device: z.string().trim().max(80).optional().nullable(),
  os: z.string().trim().max(80).optional().nullable(),
  url: z.string().trim().max(500).optional().nullable(),
});

export const changeStatusSchema = z.object({
  status: z.nativeEnum(BugStatus),
  reason: z.string().trim().max(2000).optional().nullable(),
  duplicateOfId: z.string().min(1).optional().nullable(),
});

export const acknowledgeSchema = z.object({
  assignedToUserId: z.string().min(1).optional().nullable(),
  priority: z.nativeEnum(BugPriority).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  internalNote: z.string().trim().max(4000).optional().nullable(),
});

export const updateBugSchema = z.object({
  priority: z.nativeEnum(BugPriority).optional(),
  severity: z.nativeEnum(BugSeverity).optional(),
  assignedToUserId: z.string().min(1).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  module: z.string().trim().max(80).optional().nullable(),
  internalNote: z.string().trim().max(4000).optional().nullable(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(8000),
  isInternal: z.boolean().default(false),
});

export type CreateBugDto = z.infer<typeof createBugSchema>;
