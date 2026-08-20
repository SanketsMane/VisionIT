import { prisma } from '@config/database';
import { env } from '@config/env';
import { ApiError } from '@utils/api-error';
import { publicUserSelect } from '@modules/auth/auth.model';
import { CURRENCY_SYMBOL } from '@utils/money.util';
import type { CompanyProfileDto, UpdateProfileDto } from './settings.validation';

const blankToNull = <T extends Record<string, unknown>>(input: T): T => {
  const output = { ...input };
  for (const key of Object.keys(output)) {
    if (output[key] === '') (output as Record<string, unknown>)[key] = null;
  }
  return output;
};

export const SettingsService = {
  async getCompany(userId: string) {
    const company = await prisma.companyProfile.findUnique({ where: { userId } });
    if (!company) throw ApiError.notFound('Company profile');
    return company;
  },

  /** Upsert so a workspace created before this field existed still resolves. */
  updateCompany: (userId: string, dto: Partial<CompanyProfileDto>) =>
    prisma.companyProfile.upsert({
      where: { userId },
      update: blankToNull(dto),
      create: { userId, legalName: dto.legalName ?? 'My Business', ...blankToNull(dto) },
    }),

  updateProfile: (userId: string, dto: UpdateProfileDto) =>
    prisma.user.update({
      where: { id: userId },
      data: blankToNull(dto),
      select: publicUserSelect,
    }),

  /** Static reference data the settings screens need to render their pickers. */
  reference: () => ({
    currencies: Object.entries(CURRENCY_SYMBOL).map(([code, symbol]) => ({ code, symbol })),
    fiscalYearStartMonths: [
      { value: 1, label: 'January (calendar year)' },
      { value: 4, label: 'April (India, UK)' },
      { value: 7, label: 'July (Australia)' },
      { value: 10, label: 'October (US federal)' },
    ],
    timezones: [
      'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London',
      'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC',
    ],
    features: {
      aiEnabled: env.hasOpenAi,
      aiModel: env.OPENAI_MODEL,
      globalSmtpConfigured: env.hasGlobalSmtp,
      globalResendConfigured: env.hasGlobalResend,
      maxUploadMb: env.MAX_UPLOAD_SIZE_MB,
    },
  }),

  /** Recent audit trail across the whole workspace. */
  async activity(userId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activityLog.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  },

  listNotifications: (userId: string) =>
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),

  markNotificationRead: (userId: string, id: string) =>
    prisma.notification.update({ where: { id, userId }, data: { isRead: true } }),

  markAllNotificationsRead: (userId: string) =>
    prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }),
};

export default SettingsService;
