import { z } from 'zod';

const now = new Date();

export const periodSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((d) => !d.from || !d.to || d.to >= d.from, {
  message: 'End date must be on or after the start date',
  path: ['to'],
});

export const asOfSchema = z.object({ asOf: z.coerce.date().optional() });

export const monthlySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(now.getUTCFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(now.getUTCMonth() + 1),
});

export const trendSchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});

export const fiscalSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type PeriodDto = z.infer<typeof periodSchema>;
export type MonthlyDto = z.infer<typeof monthlySchema>;
