import { AccountSubtype, AccountType } from '@prisma/client';
import { z } from 'zod';

export const accountIdSchema = z.object({ id: z.string().min(1) });

export const createAccountSchema = z.object({
  code: z.string().trim().min(1, 'Account code is required').max(20).regex(/^[A-Za-z0-9.\-]+$/, 'Use letters, numbers, dots or dashes only'),
  name: z.string().trim().min(2, 'Account name is required').max(150),
  type: z.nativeEnum(AccountType),
  subtype: z.nativeEnum(AccountSubtype),
  parentId: z.string().min(1).optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  openingBalance: z.coerce.number().default(0),
  description: z.string().trim().max(1000).optional().nullable(),
  bankName: z.string().trim().max(150).optional().nullable(),
  bankAccountNumber: z.string().trim().max(50).optional().nullable(),
  bankIfsc: z.string().trim().max(20).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial().omit({ openingBalance: true });

export const listAccountsSchema = z.object({
  type: z.nativeEnum(AccountType).optional(),
  subtype: z.nativeEnum(AccountSubtype).optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z.coerce.boolean().optional(),
  includeBalances: z.coerce.boolean().default(false),
  asOf: z.coerce.date().optional(),
});

export const accountLedgerSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  date: z.coerce.date().default(() => new Date()),
  narration: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(100).optional(),
}).refine((d) => d.fromAccountId !== d.toAccountId, {
  message: 'Source and destination accounts must be different',
  path: ['toAccountId'],
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type ListAccountsDto = z.infer<typeof listAccountsSchema>;
export type TransferDto = z.infer<typeof transferSchema>;
