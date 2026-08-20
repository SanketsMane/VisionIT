import { ProjectRole } from '@prisma/client';
import { z } from 'zod';

export const projectIdParam = z.object({ projectId: z.string().min(1) });
export const invitationIdParam = z.object({
  projectId: z.string().min(1),
  invitationId: z.string().min(1),
});
export const tokenParam = z.object({ token: z.string().min(20) });

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  name: z.string().trim().max(120).optional(),
  role: z.nativeEnum(ProjectRole).default(ProjectRole.CLIENT_OWNER),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(14),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number');

export const acceptInvitationSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(120),
    mobile: z.string().trim().min(6, 'Enter your mobile number').max(25),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.literal(true, {
      message: 'You must accept the terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** An existing portal user joining another project needs only to sign in. */
export const acceptAsExistingSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

export const listInvitationsSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']).optional(),
});

export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;
