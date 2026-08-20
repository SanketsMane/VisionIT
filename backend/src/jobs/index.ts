import { logger } from '@config/logger';
import { InvoicesModel } from '@modules/invoices/invoices.model';
import { AuthModel } from '@modules/auth/auth.model';
import { prisma } from '@config/database';
import { NotificationType } from '@prisma/client';

type Timer = ReturnType<typeof setInterval>;

const timers: Timer[] = [];

const HOUR = 60 * 60 * 1000;

/**
 * Flags open invoices whose due date has passed and raises one notification
 * per newly-overdue invoice. Runs hourly rather than at a fixed time so a
 * restart never skips a day's sweep.
 */
const sweepOverdueInvoices = async (): Promise<void> => {
  try {
    const beforeIds = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
      select: { id: true, userId: true, number: true },
    });

    if (!beforeIds.length) return;

    const { count } = await InvoicesModel.flagOverdue();

    await prisma.notification.createMany({
      data: beforeIds.map((invoice) => ({
        userId: invoice.userId,
        type: NotificationType.INVOICE_OVERDUE,
        title: `Invoice ${invoice.number} is overdue`,
        body: 'The due date has passed and the balance is still outstanding.',
        link: `/invoices/${invoice.id}`,
      })),
    });

    logger.info(`[cron] flagged ${count} invoice(s) as overdue`);
  } catch (error) {
    logger.error('[cron] overdue sweep failed', { error: String(error) });
  }
};

/** Drops expired and revoked refresh tokens so the table stays small. */
const purgeExpiredTokens = async (): Promise<void> => {
  try {
    const { count } = await AuthModel.purgeExpired();
    if (count) logger.info(`[cron] purged ${count} expired refresh token(s)`);
  } catch (error) {
    logger.error('[cron] token purge failed', { error: String(error) });
  }
};

/** Sends any queued email whose scheduled time has arrived. */
const dispatchScheduledEmails = async (): Promise<void> => {
  try {
    const due = await prisma.emailMessage.findMany({
      where: { status: 'QUEUED', scheduledAt: { lte: new Date() } },
      select: { id: true, userId: true },
      take: 25,
    });
    if (!due.length) return;

    // Imported lazily to keep the job module free of a circular dependency
    // through the email → invoice → PDF chain at startup.
    const { EmailService } = await import('@modules/email/email.service');

    for (const message of due) {
      try {
        await EmailService.send(message.userId, message.id);
      } catch (error) {
        logger.warn('[cron] scheduled email failed', { emailId: message.id, error: String(error) });
      }
    }
  } catch (error) {
    logger.error('[cron] scheduled email dispatch failed', { error: String(error) });
  }
};

const every = (intervalMs: number, task: () => Promise<void>, runImmediately = false): void => {
  if (runImmediately) void task();
  const timer = setInterval(() => void task(), intervalMs);
  timer.unref();
  timers.push(timer);
};

/** Marks invitations past their expiry so a stale link reads correctly. */
const expireInvitations = async (): Promise<void> => {
  try {
    const { InvitationsModel } = await import('@modules/portal/invitations/invitations.model');
    const { count } = await InvitationsModel.expireStale();
    if (count) logger.info(`[cron] expired ${count} stale invitation(s)`);
  } catch (error) {
    logger.error('[cron] invitation expiry failed', { error: String(error) });
  }
};

/** Warns clients whose technical support cover is about to lapse. */
const remindSupportExpiry = async (): Promise<void> => {
  // Imported lazily for the same reason as the email dispatcher: it pulls in
  // the notification chain, which must not load before the app is wired.
  const { sweepSupportReminders } = await import('@modules/support/support.reminders');
  await sweepSupportReminders();
};

export const startScheduledJobs = (): void => {
  every(HOUR, sweepOverdueInvoices, true);
  every(6 * HOUR, purgeExpiredTokens, false);
  every(HOUR, expireInvitations, true);
  every(5 * 60 * 1000, dispatchScheduledEmails, false);
  // Hourly rather than daily so a restart never skips the day a term lapses;
  // `remindersSent` keeps the extra runs from mailing anyone twice.
  every(HOUR, remindSupportExpiry, true);
  logger.info(
    '⏱️  Background jobs scheduled (overdue sweep, token purge, invitation expiry, scheduled email, support expiry)',
  );
};

export const stopScheduledJobs = (): void => {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
};
