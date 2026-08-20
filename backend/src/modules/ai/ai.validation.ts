import { AiTone, EmailPurpose } from '@prisma/client';
import { z } from 'zod';

export const generateEmailSchema = z.object({
  purpose: z.nativeEnum(EmailPurpose).default(EmailPurpose.CUSTOM),
  tone: z.nativeEnum(AiTone).default(AiTone.PROFESSIONAL),
  instructions: z.string().trim().max(3000).optional(),
  language: z.string().trim().max(40).default('English'),
  lengthHint: z.enum(['short', 'medium', 'detailed']).default('medium'),
  clientId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  includeSignature: z.boolean().default(true),
}).refine(
  (data) => data.purpose !== EmailPurpose.CUSTOM || Boolean(data.instructions?.trim()),
  { message: 'Describe what the email should say when using a custom purpose', path: ['instructions'] },
);

export const improveEmailSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  bodyHtml: z.string().trim().min(10, 'There is no draft to improve').max(50000),
  instruction: z.string().trim().min(3, 'Describe how the draft should change').max(1000),
  tone: z.nativeEnum(AiTone).optional(),
});

export const subjectSuggestSchema = z.object({
  bodyHtml: z.string().trim().min(10).max(50000),
  purpose: z.nativeEnum(EmailPurpose).optional(),
});

export const historySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const usageSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type GenerateEmailDto = z.infer<typeof generateEmailSchema>;
