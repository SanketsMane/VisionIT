import { z } from 'zod';

export const companyProfileSchema = z.object({
  legalName: z.string().trim().min(2, 'Business name is required').max(180),
  tradeName: z.string().trim().max(180).optional().nullable(),
  logoUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  signatureUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(25).optional().nullable(),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),

  addressLine1: z.string().trim().max(200).optional().nullable(),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().max(100).default('India'),

  taxLabel: z.string().trim().max(30).optional().nullable(),
  taxNumber: z.string().trim().max(40).optional().nullable(),
  panNumber: z.string().trim().max(20).optional().nullable(),
  cinNumber: z.string().trim().max(30).optional().nullable(),

  bankName: z.string().trim().max(150).optional().nullable(),
  bankAccountName: z.string().trim().max(150).optional().nullable(),
  bankAccountNumber: z.string().trim().max(40).optional().nullable(),
  bankIfsc: z.string().trim().max(20).optional().nullable(),
  bankSwift: z.string().trim().max(20).optional().nullable(),
  upiId: z.string().trim().max(80).optional().nullable(),

  baseCurrency: z.string().trim().length(3).toUpperCase().default('INR'),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).default(4),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(18),
  defaultPaymentTerms: z.coerce.number().int().min(0).max(365).default(15),
  invoiceFooterNote: z.string().trim().max(1000).optional().nullable(),
  defaultTerms: z.string().trim().max(6000).optional().nullable(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(25).optional().nullable(),
  designation: z.string().trim().max(120).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  timezone: z.string().trim().max(60).optional(),
  locale: z.string().trim().max(20).optional(),
});

export type CompanyProfileDto = z.infer<typeof companyProfileSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
