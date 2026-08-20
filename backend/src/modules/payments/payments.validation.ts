import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

export const paymentIdSchema = z.object({ id: z.string().min(1) });

export const listPaymentsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['paidAt', 'createdAt', 'amount']).default('paidAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  accountId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListPaymentsDto = z.infer<typeof listPaymentsSchema>;
