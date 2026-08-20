import type { Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import type { ListEmailsDto } from './email.validation';

export const emailInclude = {
  client: { select: { id: true, name: true, companyName: true, avatarUrl: true } },
  invoice: { select: { id: true, number: true, total: true, currency: true, status: true } },
  emailAccount: { select: { id: true, label: true, fromName: true, fromEmail: true } },
} satisfies Prisma.EmailMessageInclude;

/** Credential columns are never selected — they must not reach the API layer. */
export const emailAccountSelect = {
  id: true,
  label: true,
  provider: true,
  fromName: true,
  fromEmail: true,
  replyTo: true,
  smtpHost: true,
  smtpPort: true,
  smtpSecure: true,
  smtpUser: true,
  signatureHtml: true,
  isDefault: true,
  isVerified: true,
  lastError: true,
  createdAt: true,
} satisfies Prisma.EmailAccountSelect;

export const EmailModel = {
  buildWhere(userId: string, query: ListEmailsDto): Prisma.EmailMessageWhereInput {
    const where: Prisma.EmailMessageWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.purpose) where.purpose = query.purpose;
    if (query.clientId) where.clientId = query.clientId;
    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { bodyText: { contains: query.search, mode: 'insensitive' } },
        { toAddresses: { has: query.search.toLowerCase() } },
      ];
    }
    return where;
  },

  findMany: (where: Prisma.EmailMessageWhereInput, args: { skip: number; take: number }) =>
    prisma.emailMessage.findMany({
      where,
      ...args,
      include: emailInclude,
      orderBy: { createdAt: 'desc' },
    }),

  count: (where: Prisma.EmailMessageWhereInput) => prisma.emailMessage.count({ where }),

  findById: (userId: string, id: string) =>
    prisma.emailMessage.findFirst({ where: { id, userId }, include: emailInclude }),

  create: (data: Prisma.EmailMessageCreateInput) =>
    prisma.emailMessage.create({ data, include: emailInclude }),

  update: (userId: string, id: string, data: Prisma.EmailMessageUpdateInput) =>
    prisma.emailMessage.update({ where: { id, userId }, data, include: emailInclude }),

  delete: (userId: string, id: string) => prisma.emailMessage.delete({ where: { id, userId } }),

  statusCounts: (userId: string) =>
    prisma.emailMessage.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),

  dueScheduled: (now: Date) =>
    prisma.emailMessage.findMany({
      where: { status: 'QUEUED', scheduledAt: { lte: now } },
      select: { id: true, userId: true },
      take: 50,
    }),

  // ---- Sending accounts ---------------------------------------------------

  listAccounts: (userId: string) =>
    prisma.emailAccount.findMany({
      where: { userId },
      select: emailAccountSelect,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),

  /** Includes encrypted credentials — for the send path only, never the API. */
  findAccountWithSecrets: (userId: string, id: string) =>
    prisma.emailAccount.findFirst({ where: { id, userId } }),

  findDefaultAccountWithSecrets: (userId: string) =>
    prisma.emailAccount.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),

  createAccount: (data: Prisma.EmailAccountCreateInput) =>
    prisma.emailAccount.create({ data, select: emailAccountSelect }),

  updateAccount: (userId: string, id: string, data: Prisma.EmailAccountUpdateInput) =>
    prisma.emailAccount.update({ where: { id, userId }, data, select: emailAccountSelect }),

  deleteAccount: (userId: string, id: string) =>
    prisma.emailAccount.delete({ where: { id, userId } }),

  demoteOtherDefaults: (userId: string, exceptId: string) =>
    prisma.emailAccount.updateMany({
      where: { userId, isDefault: true, id: { not: exceptId } },
      data: { isDefault: false },
    }),

  // ---- Templates ----------------------------------------------------------

  listTemplates: (userId: string) =>
    prisma.emailTemplate.findMany({ where: { userId }, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] }),

  findTemplate: (userId: string, id: string) =>
    prisma.emailTemplate.findFirst({ where: { id, userId } }),

  createTemplate: (data: Prisma.EmailTemplateCreateInput) => prisma.emailTemplate.create({ data }),

  updateTemplate: (userId: string, id: string, data: Prisma.EmailTemplateUpdateInput) =>
    prisma.emailTemplate.update({ where: { id, userId }, data }),

  deleteTemplate: (userId: string, id: string) =>
    prisma.emailTemplate.delete({ where: { id, userId } }),
};

export default EmailModel;
