import { ProjectRole } from '@prisma/client';
import { z } from 'zod';

export const memberIdParam = z.object({
  projectId: z.string().min(1),
  memberId: z.string().min(1),
});

export const updateRoleSchema = z.object({
  role: z.nativeEnum(ProjectRole),
});

export const addInternalSchema = z.object({
  userId: z.string().min(1),
});
