import { ClientStatus } from '@prisma/client';
import { z } from 'zod';

export const clientIdSchema = z.object({ id: z.string().min(1) });

const addressFields = {
  billingAddressLine1: z.string().trim().max(200).optional().nullable(),
  billingAddressLine2: z.string().trim().max(200).optional().nullable(),
  billingCity: z.string().trim().max(100).optional().nullable(),
  billingState: z.string().trim().max(100).optional().nullable(),
  billingPostalCode: z.string().trim().max(20).optional().nullable(),
  billingCountry: z.string().trim().max(100).optional().nullable(),
};

export const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name is required').max(150),
  companyName: z.string().trim().max(150).optional().nullable(),
  email: z.string().trim().toLowerCase().email('Enter a valid email').optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  website: z.string().trim().url('Enter a valid URL').optional().nullable().or(z.literal('')),
  status: z.nativeEnum(ClientStatus).default(ClientStatus.ACTIVE),
  currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase().default('INR'),
  taxNumber: z.string().trim().max(40).optional().nullable(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(15),
  notes: z.string().trim().max(5000).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  ...addressFields,
});

export const updateClientSchema = createClientSchema.partial();

export const listClientsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'name', 'updatedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  tag: z.string().trim().max(40).optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  role: z.string().trim().max(100).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export type CreateClientDto = z.infer<typeof createClientSchema>;
export type UpdateClientDto = z.infer<typeof updateClientSchema>;
export type ListClientsDto = z.infer<typeof listClientsSchema>;
export type ContactDto = z.infer<typeof contactSchema>;
