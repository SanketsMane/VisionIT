import { z } from 'zod';

/**
 * Sign-up from the public site.
 *
 * Note what is *not* here: no role, no userType, no ownerId. The old
 * `/auth/register` took a body and provisioned a whole workspace from it,
 * which is how a stranger could mint themselves an admin account. Everything
 * that decides privilege is set by the server in `LeadsService.register`, so
 * there is no field a caller could add to escalate.
 */
export const leadRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(180),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid mobile number')
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, 'Mobile number can only contain digits, spaces, + - ( )'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(128)
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
  source: z.enum(['FREELANCER', 'GOOGLE', 'SOCIAL_MEDIA', 'REFERRAL', 'OTHER']),
  /// Only meaningful for REFERRAL and OTHER; the form shows it conditionally.
  sourceDetail: z.string().trim().max(160).optional().or(z.literal('')),
  company: z.string().trim().max(150).optional().or(z.literal('')),
  requirement: z.string().trim().max(2000).optional().or(z.literal('')),
  /// Bots fill hidden fields. Accepts anything so a filled trap looks like a
  /// success rather than telling the author they were spotted.
  website: z.string().max(200).optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(180),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  company: z.string().trim().max(150).optional().or(z.literal('')),
  subject: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Tell us a little more').max(4000),
  source: z.enum(['FREELANCER', 'GOOGLE', 'SOCIAL_MEDIA', 'REFERRAL', 'OTHER']).optional(),
  website: z.string().max(200).optional(),
});

export const listLeadsSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED']).optional(),
  source: z.enum(['FREELANCER', 'GOOGLE', 'SOCIAL_MEDIA', 'REFERRAL', 'OTHER']).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateLeadSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'ARCHIVED']).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const leadIdSchema = z.object({ id: z.string().min(1) });

export type LeadRegisterDto = z.infer<typeof leadRegisterSchema>;
export type ContactDto = z.infer<typeof contactSchema>;
export type ListLeadsDto = z.infer<typeof listLeadsSchema>;
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;
