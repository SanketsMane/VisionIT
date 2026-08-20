import { DiscountType, DocumentType, InvoiceStatus, PaymentMethod } from '@prisma/client';
import { z } from 'zod';

export const invoiceIdSchema = z.object({ id: z.string().min(1) });
export const publicTokenSchema = z.object({ token: z.string().min(10) });

export const invoiceItemSchema = z.object({
  title: z.string().trim().min(1, 'Item description is required').max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  hsnSac: z.string().trim().max(20).optional().nullable(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero').max(1_000_000),
  unit: z.string().trim().max(20).default('nos'),
  unitPrice: z.coerce.number().min(0, 'Rate cannot be negative'),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  sortOrder: z.coerce.number().int().default(0),
});

const invoiceFields = z.object({
  clientId: z.string().min(1, 'Please select a client'),
  projectId: z.string().min(1).optional().nullable(),
  documentType: z.nativeEnum(DocumentType).default(DocumentType.INVOICE),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  exchangeRate: z.coerce.number().positive().default(1),

  issueDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date().optional(),
  poNumber: z.string().trim().max(60).optional().nullable(),

  items: z.array(invoiceItemSchema).min(1, 'Add at least one line item').max(200),

  discountType: z.nativeEnum(DiscountType).default(DiscountType.NONE),
  discountValue: z.coerce.number().min(0).default(0),
  shippingAmount: z.coerce.number().min(0).default(0),
  taxInclusive: z.boolean().default(false),
  isInterState: z.boolean().default(false),
  roundOffTotal: z.boolean().default(false),

  notes: z.string().trim().max(4000).optional().nullable(),
  terms: z.string().trim().max(6000).optional().nullable(),
  templateKey: z.enum(['modern', 'classic', 'minimal', 'corporate', 'creative']).default('modern'),
  accentColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #4F46E5').default('#0076FF'),

  isRecurring: z.boolean().default(false),
  recurrenceRule: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']).optional().nullable(),
});

/**
 * Zod 4 refuses `.partial()` on a refined schema, so the cross-field rules live
 * on a wrapper around the plain field shape. `invoiceFields` stays reusable for
 * updates and for the totals-preview pick below.
 */
export const createInvoiceSchema = invoiceFields.superRefine((data, ctx) => {
  if (data.dueDate && data.dueDate < data.issueDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dueDate'], message: 'Due date cannot be before the issue date' });
  }
  if (data.discountType === DiscountType.PERCENTAGE && data.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Percentage discount cannot exceed 100%' });
  }
  if (data.isRecurring && !data.recurrenceRule) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['recurrenceRule'], message: 'Choose how often this invoice should repeat' });
  }
});

export const updateInvoiceSchema = invoiceFields.partial();

/** Field shape without refinements — used for `.pick()` and `.partial()`. */
export { invoiceFields };

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['issueDate', 'dueDate', 'createdAt', 'total', 'number', 'balanceDue']).default('issueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  documentType: z.nativeEnum(DocumentType).optional(),
  clientId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  overdueOnly: z.coerce.boolean().optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  paidAt: z.coerce.date().default(() => new Date()),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  accountId: z.string().min(1, 'Choose which account received the money'),
  reference: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  feeAmount: z.coerce.number().min(0).default(0),
});

export const changeStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

export const numberSequenceSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  prefix: z.string().trim().min(1).max(10).toUpperCase(),
  padding: z.coerce.number().int().min(1).max(10),
  nextNumber: z.coerce.number().int().min(1),
  resetYearly: z.boolean(),
});

export const duplicateSchema = z.object({
  issueDate: z.coerce.date().optional(),
});

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceDto = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesDto = z.infer<typeof listInvoicesSchema>;
export type RecordPaymentDto = z.infer<typeof recordPaymentSchema>;

/** Optional overrides when emailing a document to a client. */
export const emailInvoiceSchema = z.object({
  /** Defaults to the client's primary contact, then the client's own address. */
  to: z.email('Enter a valid email address').optional(),
  event: z.enum(['invoice.created', 'invoice.due', 'invoice.overdue']).optional(),
});
export type EmailInvoiceDto = z.infer<typeof emailInvoiceSchema>;
