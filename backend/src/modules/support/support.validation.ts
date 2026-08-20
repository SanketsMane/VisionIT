import { SupportPlan } from '@prisma/client';
import { z } from 'zod';

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().or(z.literal('').transform(() => null));

/**
 * Setting up or editing a support term.
 *
 * `endDate` is deliberately absent: it is always derived from the start date
 * plus the duration, so the two can never drift apart. An admin who wants an
 * unusual end date changes the duration.
 */
export const upsertSupportSchema = z.object({
  plan: z.nativeEnum(SupportPlan).default(SupportPlan.STANDARD),
  planLabel: optionalText(80),

  startDate: z.coerce.date({ message: 'Pick the date support begins' }),
  durationMonths: z.coerce
    .number()
    .int('Use whole months')
    .min(1, 'Support must run for at least a month')
    .max(120, 'Use 120 months or fewer'),

  inclusions: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  responseTime: optionalText(120),
  supportEmail: z.email('Enter a valid email address').optional().nullable().or(z.literal('').transform(() => null)),
  supportPhone: optionalText(40),
  notes: optionalText(4000),
});

/** Extending an existing term. Adds months to whichever end is later. */
export const renewSupportSchema = z.object({
  months: z.coerce.number().int().min(1).max(120).default(12),
  /**
   * By default a renewal continues from the current end date so no cover is
   * lost. Set this to restart the clock from today instead — the right choice
   * when a lapsed term is being picked back up.
   */
  restartFromToday: z.boolean().default(false),
});

export const cancelSupportSchema = z.object({
  reason: optionalText(500),
});

export type UpsertSupportDto = z.infer<typeof upsertSupportSchema>;
export type RenewSupportDto = z.infer<typeof renewSupportSchema>;
export type CancelSupportDto = z.infer<typeof cancelSupportSchema>;
