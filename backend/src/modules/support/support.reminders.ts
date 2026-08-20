import { prisma } from '@config/database';
import { logger } from '@config/logger';
import { formatDate } from '@utils/date.util';
import { NotificationService } from '@modules/notifications/notification.service';
import { SupportModel } from './support.model';
import { REMINDER_DAYS } from './support.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Warns clients before their support cover lapses, then once when it does.
 *
 * The `remindersSent` array on the row is what makes this safe to run hourly:
 * each milestone is recorded after it fires, so a restart, a clock change or a
 * second worker cannot mail the same client twice. Editing the end date clears
 * the array, because the old warnings no longer describe reality.
 */
export const sweepSupportReminders = async (): Promise<void> => {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + REMINDER_DAYS[0] * MS_PER_DAY);
    const terms = await SupportModel.dueForReminder(horizon);
    if (!terms.length) return;

    let sent = 0;

    for (const term of terms) {
      const msLeft = term.endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / MS_PER_DAY);

      // Which milestone does today cross? The largest threshold at or below
      // the days remaining, so a gap in the schedule still fires exactly one.
      const milestone =
        msLeft <= 0 ? 'expired' : REMINDER_DAYS.find((d) => daysLeft <= d)?.toString();

      if (!milestone || term.remindersSent.includes(milestone)) continue;

      NotificationService.emitAsync({
        event: milestone === 'expired' ? 'support.expired' : 'support.expiring',
        audience: { projectId: term.projectId, include: ['client'] },
        context: {
          projectName: term.project.title,
          projectCode: term.project.code ?? undefined,
          count: String(Math.max(0, daysLeft)),
          dueDate: formatDate(term.endDate),
        },
        projectId: term.projectId,
        link: `/portal/projects/${term.projectId}`,
      });

      // The studio needs to know too — this is the renewal conversation.
      NotificationService.emitAsync({
        event: milestone === 'expired' ? 'support.expired' : 'support.expiring',
        userIds: [term.project.userId],
        context: {
          projectName: term.project.title,
          count: String(Math.max(0, daysLeft)),
          dueDate: formatDate(term.endDate),
        },
        projectId: term.projectId,
        link: `/projects/${term.projectId}`,
      });

      await prisma.projectSupport.update({
        where: { id: term.id },
        data: { remindersSent: { push: milestone } },
      });
      sent += 1;
    }

    if (sent) logger.info(`[cron] sent ${sent} support expiry reminder(s)`);
  } catch (error) {
    logger.error('[cron] support reminder sweep failed', { error: String(error) });
  }
};

export default sweepSupportReminders;
