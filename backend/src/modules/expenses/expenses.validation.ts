import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

export const expenseIdSchema = z.object({ id: z.string().min(1) });

export const createExpenseSchema = z.object({
  vendor: z.string().trim().min(1, 'Vendor name is required').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  date: z.coerce.date().default(() => new Date()),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  taxAmount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),

  categoryId: z.string().min(1).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  paidFromAccountId: z.string().min(1, 'Choose which account this was paid from'),
  /** Expense account the cost is booked against in the chart of accounts. */
  expenseAccountId: z.string().min(1, 'Choose an expense account'),

  reference: z.string().trim().max(120).optional().nullable(),
  receiptUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  billable: z.boolean().default(false),
  reimbursed: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const listExpensesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['date', 'createdAt', 'total', 'vendor']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  billable: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;
export type ListExpensesDto = z.infer<typeof listExpensesSchema>;
