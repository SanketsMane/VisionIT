import { JournalSource } from '@prisma/client';
import { z } from 'zod';

export const entryIdSchema = z.object({ id: z.string().min(1) });

const lineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  debit: z.coerce.number().nonnegative().default(0),
  credit: z.coerce.number().nonnegative().default(0),
  description: z.string().trim().max(300).optional().nullable(),
});

export const createEntrySchema = z.object({
  date: z.coerce.date().default(() => new Date()),
  narration: z.string().trim().max(500).optional().nullable(),
  reference: z.string().trim().max(100).optional().nullable(),
  lines: z.array(lineSchema).min(2, 'A journal entry needs at least two lines').max(100),
}).superRefine((data, ctx) => {
  // Mirrors the service-level guarantee so the client gets a field-level error
  // instead of a generic 422 from deeper in the stack.
  const debit = data.lines.reduce((s, l) => s + l.debit, 0);
  const credit = data.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(debit - credit) >= 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lines'],
      message: `Debits (${debit.toFixed(2)}) must equal credits (${credit.toFixed(2)})`,
    });
  }
});

export const listEntriesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  source: z.nativeEnum(JournalSource).optional(),
  accountId: z.string().min(1).optional(),
  search: z.string().trim().max(120).optional(),
});

export const trialBalanceSchema = z.object({ asOf: z.coerce.date().optional() });

export type CreateEntryDto = z.infer<typeof createEntrySchema>;
export type ListEntriesDto = z.infer<typeof listEntriesSchema>;
