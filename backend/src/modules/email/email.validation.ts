import { EmailProvider, EmailPurpose } from '@prisma/client';
import { z } from 'zod';
import { MAX_RECIPIENTS_PER_MESSAGE } from './email.constants';

export const emailIdSchema = z.object({ id: z.string().min(1) });

const emailList = z
  .array(z.string().trim().toLowerCase().email('One of the addresses is not valid'))
  .max(MAX_RECIPIENTS_PER_MESSAGE, `No more than ${MAX_RECIPIENTS_PER_MESSAGE} recipients per message`);

export const composeEmailSchema = z.object({
  toAddresses: emailList.min(1, 'Add at least one recipient'),
  ccAddresses: emailList.default([]),
  bccAddresses: emailList.default([]),
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  bodyHtml: z.string().trim().min(1, 'The email body cannot be empty').max(200000),
  bodyText: z.string().trim().max(200000).optional().nullable(),
  purpose: z.nativeEnum(EmailPurpose).default(EmailPurpose.CUSTOM),
  clientId: z.string().min(1).optional().nullable(),
  invoiceId: z.string().min(1).optional().nullable(),
  emailAccountId: z.string().min(1).optional().nullable(),
  aiGenerated: z.boolean().default(false),
  attachInvoicePdf: z.boolean().default(false),
  scheduledAt: z.coerce.date().optional().nullable(),
});

export const updateDraftSchema = composeEmailSchema.partial();

export const listEmailsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'BOUNCED']).optional(),
  purpose: z.nativeEnum(EmailPurpose).optional(),
  clientId: z.string().min(1).optional(),
  search: z.string().trim().max(120).optional(),
});

const emailAccountFields = z.object({
  label: z.string().trim().min(2, 'Give this mailbox a label').max(80),
  provider: z.nativeEnum(EmailProvider).default(EmailProvider.SMTP),
  fromName: z.string().trim().min(1, 'Sender name is required').max(120),
  fromEmail: z.string().trim().toLowerCase().email('Enter a valid sender address'),
  replyTo: z.string().trim().toLowerCase().email().optional().nullable(),

  smtpHost: z.string().trim().max(200).optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().default(true),
  smtpUser: z.string().trim().max(200).optional().nullable(),
  smtpPassword: z.string().max(500).optional().nullable(),
  apiKey: z.string().max(500).optional().nullable(),

  signatureHtml: z.string().trim().max(20000).optional().nullable(),
  isDefault: z.boolean().default(false),
});

/** Provider-conditional rules sit on the create schema; updates use the base. */
export const emailAccountSchema = emailAccountFields.superRefine((data, ctx) => {
  if (data.provider === EmailProvider.SMTP || data.provider === EmailProvider.GMAIL) {
    if (!data.smtpHost) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtpHost'], message: 'SMTP host is required' });
    }
    if (!data.smtpUser) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtpUser'], message: 'SMTP username is required' });
    }
  } else if (!data.apiKey) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['apiKey'], message: 'An API key is required for this provider' });
  }
});

export const updateEmailAccountSchema = emailAccountFields.partial();

export const templateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().trim().min(1).max(100000),
  purpose: z.nativeEnum(EmailPurpose).default(EmailPurpose.CUSTOM),
  variables: z.array(z.string().trim().max(60)).max(40).default([]),
});

export const renderTemplateSchema = z.object({
  clientId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

export type ComposeEmailDto = z.infer<typeof composeEmailSchema>;
export type ListEmailsDto = z.infer<typeof listEmailsSchema>;
export type EmailAccountDto = z.infer<typeof emailAccountSchema>;
export type TemplateDto = z.infer<typeof templateSchema>;
