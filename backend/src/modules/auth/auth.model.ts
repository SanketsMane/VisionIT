import type { Prisma, User } from '@prisma/client';
import { prisma } from '@config/database';
import type { PublicUser } from './auth.types';

/**
 * Data-access layer for authentication. Controllers and services never touch
 * `prisma` for auth concerns directly — everything funnels through here so the
 * `publicUserSelect` projection stays the single source of truth for what
 * leaves the server (a password hash can never leak by accident).
 */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  phone: true,
  designation: true,
  timezone: true,
  locale: true,
  emailVerified: true,
  userType: true,
  ownerId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const AuthModel = {
  findByEmail: (email: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { email: email.toLowerCase() } }),

  findPublicById: (id: string): Promise<PublicUser | null> =>
    prisma.user.findUnique({ where: { id }, select: publicUserSelect }),

  findByIdWithPassword: (id: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { id } }),

  emailExists: async (email: string): Promise<boolean> =>
    (await prisma.user.count({ where: { email: email.toLowerCase() } })) > 0,

  createUser: (data: Prisma.UserCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.user.create({ data, select: publicUserSelect }),

  updateUser: (id: string, data: Prisma.UserUpdateInput): Promise<PublicUser> =>
    prisma.user.update({ where: { id }, data, select: publicUserSelect }),

  touchLastLogin: (id: string): Promise<User> =>
    prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),

  // ---- Refresh token rotation ---------------------------------------------

  storeRefreshToken: (data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) => prisma.refreshToken.create({ data }),

  findActiveRefreshToken: (tokenHash: string) =>
    prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { ...publicUserSelect, isActive: true } } },
    }),

  revokeRefreshToken: (id: string) =>
    prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } }),

  revokeAllForUser: (userId: string) =>
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  listSessions: (userId: string) =>
    prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),

  /** Housekeeping for the nightly cron — drops dead rows from the table. */
  purgeExpired: () =>
    prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    }),

  // ---- Password reset -----------------------------------------------------

  setResetToken: (userId: string, token: string, expires: Date) =>
    prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    }),

  findByResetToken: (token: string) =>
    prisma.user.findFirst({
      where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
    }),

  clearResetToken: (userId: string, passwordHash: string) =>
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    }),
};

export default AuthModel;
