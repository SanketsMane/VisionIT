import { Prisma, UserType } from '@prisma/client';
import prisma from '@config/database';
import { env } from '@config/env';
import logger from '@config/logger';
import { ApiError } from '@utils/api-error';
import { hashPassword } from '@utils/password.util';
import { publicUserSelect } from '@modules/auth/auth.model';
import { issueTokens } from '@modules/auth/auth.service';
import type { SessionContext } from '@modules/auth/auth.types';
import { sendTemplatedEmail } from '@modules/notifications/email-sender';
import { NotificationService } from '@modules/notifications/notification.service';
import type {
  ContactDto,
  LeadRegisterDto,
  ListLeadsDto,
  UpdateLeadDto,
} from './leads.validation';

/**
 * The workspace a self-registered lead is attached to.
 *
 * Everything a lead can reach — the catalog, services, chat — hangs off an
 * owner, so a lead with no owner would be a dead account. There is exactly one
 * OWNER on this deployment; resolving it here rather than hard-coding an id
 * keeps a fresh database working.
 */
const resolveWorkspaceOwner = async (): Promise<{ id: string; name: string; email: string }> => {
  const owner = await prisma.user.findFirst({
    where: { userType: UserType.INTERNAL, role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  });
  if (!owner) throw ApiError.internal('No workspace is available to accept sign-ups right now.');
  return owner;
};

const LEAD_SELECT = {
  ...publicUserSelect,
  leadSource: true,
  leadStatus: true,
  leadCompany: true,
  leadNote: true,
  leadReferrer: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

const blank = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const LeadsService = {
  /**
   * Create a LEAD account from the public sign-up form.
   *
   * `userType` and `role` are written here as literals. They are not read from
   * `input`, and `input` has no field for them, so no request body can turn
   * this into an admin. That is the whole reason this lives apart from
   * `AuthService.register`, which provisions a full internal workspace and
   * stays gated behind ALLOW_PUBLIC_REGISTRATION.
   */
  async register(input: LeadRegisterDto, context: SessionContext) {
    const email = input.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, userType: true },
    });
    if (existing) {
      // Deliberately specific: this is a sign-up form, not a login, and a
      // vague error here just makes people try again with the same address.
      throw ApiError.conflict(
        'An account with this email already exists. Sign in instead, or reset your password.',
      );
    }

    const owner = await resolveWorkspaceOwner();
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        phone: input.phone.trim(),
        // Fixed server-side. Never from the request.
        userType: UserType.LEAD,
        role: 'MEMBER',
        ownerId: owner.id,
        emailVerified: false,
        leadSource: input.source,
        leadStatus: 'NEW',
        leadCompany: blank(input.company),
        leadNote: blank(input.requirement),
        leadReferrer: blank(input.sourceDetail),
      },
      select: LEAD_SELECT,
    });

    logger.info('Lead registered', { userId: user.id, email, source: input.source });

    NotificationService.emitAsync({
      event: 'lead.welcome',
      userIds: [user.id],
      context: {
        recipientName: user.name,
        actionUrl: `${env.CLIENT_URL}/portal/catalog`,
      },
    });

    // The studio hears about it in-app and by email — `emit` fans out to both
    // from the event template. A lead that sits unnoticed for a week is the
    // same as no lead at all.
    NotificationService.emitAsync({
      event: 'lead.registered',
      userIds: [owner.id],
      link: `/leads/${user.id}`,
      context: {
        recipientName: owner.name,
        leadName: user.name,
        leadEmail: user.email,
        leadPhone: user.phone ?? '—',
        leadCompany: user.leadCompany ?? '—',
        leadSource: SOURCE_LABELS[input.source],
        leadNote: user.leadNote ?? '',
        actionUrl: `${env.CLIENT_URL}/leads/${user.id}`,
      },
    });

    const tokens = await issueTokens(
      { id: user.id, email: user.email, role: user.role },
      context,
    );
    return { user, tokens };
  },

  /** Public contact form. Creates no account and requires no session. */
  async contact(input: ContactDto, userId: string | null) {
    const owner = await resolveWorkspaceOwner();

    const record = await prisma.contactMessage.create({
      data: {
        ownerId: owner.id,
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        phone: blank(input.phone),
        company: blank(input.company),
        subject: blank(input.subject),
        message: input.message.trim(),
        source: input.source ?? null,
        userId,
      },
      select: { id: true, name: true, email: true, subject: true },
    });

    NotificationService.emitAsync({
      event: 'contact.received',
      userIds: [owner.id],
      link: '/leads?tab=enquiries',
      context: {
        recipientName: owner.name,
        senderName: record.name,
        senderEmail: record.email,
        senderPhone: input.phone || '—',
        senderCompany: input.company || '—',
        subject: record.subject ?? 'Website enquiry',
        messageBody: input.message,
        actionUrl: `${env.CLIENT_URL}/leads?tab=enquiries`,
      },
    });

    // The sender gets an acknowledgement, so the form never looks like a black
    // hole. Sent directly rather than through `emit`, which addresses accounts;
    // this person may not have one.
    void sendTemplatedEmail({
      to: record.email,
      event: 'contact.acknowledged',
      context: { recipientName: record.name, messageBody: input.message },
    }).catch(() => undefined);

    return { id: record.id };
  },

  async list(ownerId: string, query: ListLeadsDto) {
    const where: Prisma.UserWhereInput = {
      userType: UserType.LEAD,
      ownerId,
      ...(query.status ? { leadStatus: query.status } : {}),
      ...(query.source ? { leadSource: query.source } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { leadCompany: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          ...LEAD_SELECT,
          _count: { select: { memberships: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...lead }) => ({ ...lead, projectCount: _count.memberships })),
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async stats(ownerId: string) {
    const [byStatus, bySource, total, unreadEnquiries] = await Promise.all([
      prisma.user.groupBy({
        by: ['leadStatus'],
        where: { userType: UserType.LEAD, ownerId },
        _count: true,
      }),
      prisma.user.groupBy({
        by: ['leadSource'],
        where: { userType: UserType.LEAD, ownerId },
        _count: true,
      }),
      prisma.user.count({ where: { userType: UserType.LEAD, ownerId } }),
      prisma.contactMessage.count({ where: { ownerId, isRead: false } }),
    ]);

    return {
      total,
      unreadEnquiries,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.leadStatus ?? 'NEW', row._count])),
      bySource: Object.fromEntries(bySource.map((row) => [row.leadSource ?? 'OTHER', row._count])),
    };
  },

  async getById(ownerId: string, id: string) {
    const lead = await prisma.user.findFirst({
      where: { id, ownerId, userType: UserType.LEAD },
      select: {
        ...LEAD_SELECT,
        memberships: {
          where: { isActive: true },
          select: {
            role: true,
            joinedAt: true,
            project: { select: { id: true, title: true, code: true, status: true } },
          },
        },
      },
    });
    if (!lead) throw ApiError.notFound('Lead not found');
    return lead;
  },

  async update(ownerId: string, id: string, input: UpdateLeadDto) {
    const exists = await prisma.user.findFirst({
      where: { id, ownerId, userType: UserType.LEAD },
      select: { id: true },
    });
    if (!exists) throw ApiError.notFound('Lead not found');

    return prisma.user.update({
      where: { id },
      data: {
        ...(input.status ? { leadStatus: input.status } : {}),
        ...(input.note !== undefined ? { leadNote: blank(input.note) } : {}),
      },
      select: LEAD_SELECT,
    });
  },

  async listEnquiries(ownerId: string, page = 1, limit = 25) {
    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactMessage.count({ where: { ownerId } }),
    ]);
    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  },

  async markEnquiryRead(ownerId: string, id: string) {
    const result = await prisma.contactMessage.updateMany({
      where: { id, ownerId },
      data: { isRead: true, handledAt: new Date() },
    });
    if (!result.count) throw ApiError.notFound('Enquiry not found');
    return { id };
  },
};

export const SOURCE_LABELS: Record<string, string> = {
  FREELANCER: 'Freelancer platform',
  GOOGLE: 'Google search',
  SOCIAL_MEDIA: 'Social media',
  REFERRAL: 'A referral',
  OTHER: 'Other',
};
