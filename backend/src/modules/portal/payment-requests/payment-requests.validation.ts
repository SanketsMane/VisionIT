import { PaymentMethod, PaymentRequestStatus } from '@prisma/client';
import { z } from 'zod';

export const requestIdParam = z.object({
  projectId: z.string().min(1),
  requestId: z.string().min(1),
});

export const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(PaymentRequestStatus).optional(),
});

/**
 * Submitted as multipart because it carries a proof file, so every scalar
 * arrives as a string and must be coerced.
 */
export const submitPaymentSchema = z.object({
  invoiceId: z.string().min(1).optional().nullable().or(z.literal('')),
  amount: z.coerce.number().positive('Enter the amount you paid'),
  paidAt: z.coerce.date(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  reference: z.string().trim().max(120).optional().nullable(),
  reason: z.string().trim().min(2, 'Tell us what this payment is for').max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const approveSchema = z.object({
  accountId: z.string().min(1, 'Choose which account received the money'),
  invoiceId: z.string().min(1).optional().nullable(),
});

export const rejectSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(5, 'Give the client a reason so they can correct it')
    .max(1000),
});

export type SubmitPaymentDto = z.infer<typeof submitPaymentSchema>;
