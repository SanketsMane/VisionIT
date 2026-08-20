import { DocumentType, type Prisma } from '@prisma/client';
import { prisma } from '@config/database';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { ApiError } from '@utils/api-error';
import { hashPassword, verifyPassword } from '@utils/password.util';
import { generateToken, sha256 } from '@utils/crypto.util';
import { expiresInMs, signAccessToken, signRefreshToken, verifyRefreshToken } from '@utils/jwt.util';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  DEFAULT_EXPENSE_CATEGORIES,
} from '@modules/accounts/accounts.constants';
import { DEFAULT_EMAIL_TEMPLATES } from '@modules/email/email.constants';
import { sendTemplatedEmail } from '@modules/notifications/email-sender';
import { AuthModel, publicUserSelect } from './auth.model';
import type {
  AuthResult,
  LoginInput,
  PublicUser,
  RegisterInput,
  SessionContext,
  TokenPair,
} from './auth.types';

const REFRESH_TTL_MS = expiresInMs(env.JWT_REFRESH_EXPIRES_IN);
const ACCESS_TTL_MS = expiresInMs(env.JWT_ACCESS_EXPIRES_IN);

/**
 * Issues a fresh access/refresh pair and persists only the *hash* of the
 * refresh token, so a database dump cannot be replayed as a live session.
 */
export const issueTokens = async (
  user: { id: string; email: string; role: string },
  context: SessionContext,
): Promise<TokenPair> => {
  const jti = generateToken(24);
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await AuthModel.storeRefreshToken({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: context.userAgent ?? null,
    ipAddress: context.ipAddress ?? null,
  });

  return { accessToken, refreshToken, expiresIn: Math.floor(ACCESS_TTL_MS / 1000) };
};

/**
 * Everything a brand-new account needs to be immediately usable: a company
 * profile for invoices, a full chart of accounts, expense categories, invoice
 * number sequences and starter email templates.
 *
 * Runs inside the signup transaction — a half-provisioned workspace would be
 * worse than a failed signup.
 */
const provisionWorkspace = async (
  tx: Prisma.TransactionClient,
  userId: string,
  input: RegisterInput,
): Promise<void> => {
  const year = new Date().getFullYear();

  await tx.companyProfile.create({
    data: {
      userId,
      legalName: input.companyName?.trim() || input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
    },
  });

  await tx.account.createMany({
    data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
      userId,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      isSystem: account.isSystem,
      description: account.description ?? null,
    })),
  });

  await tx.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({ userId, ...category })),
  });

  await tx.numberSequence.createMany({
    data: [
      { userId, documentType: DocumentType.INVOICE, prefix: 'INV', year },
      { userId, documentType: DocumentType.QUOTATION, prefix: 'QUO', year },
      { userId, documentType: DocumentType.PROFORMA, prefix: 'PRO', year },
      { userId, documentType: DocumentType.CREDIT_NOTE, prefix: 'CN', year },
    ],
  });

  await tx.emailTemplate.createMany({
    data: DEFAULT_EMAIL_TEMPLATES.map((template) => ({
      userId,
      name: template.name,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      purpose: template.purpose,
      variables: template.variables,
      isSystem: true,
    })),
  });
};

export const AuthService = {
  async register(input: RegisterInput, context: SessionContext): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();

    if (await AuthModel.emailExists(email)) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          phone: input.phone ?? null,
        },
        select: publicUserSelect,
      });

      await provisionWorkspace(tx, created.id, { ...input, email });
      return created;
    });

    logger.info('New workspace provisioned', { userId: user.id, email });

    void sendTemplatedEmail({
      to: user.email,
      event: 'auth.welcome',
      userId: user.id,
      context: { recipientName: user.name, actionUrl: `${env.CLIENT_URL}/dashboard` },
    }).catch(() => undefined);

    const tokens = await issueTokens({ ...user, role: user.role }, context);
    return { user, tokens };
  },

  async login(input: LoginInput, context: SessionContext): Promise<AuthResult> {
    const user = await AuthModel.findByEmail(input.email);

    // Same generic message for "no such user" and "wrong password" so the
    // endpoint cannot be used to enumerate registered email addresses.
    if (!user) throw ApiError.unauthorized('Invalid email or password');

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

    await AuthModel.touchLastLogin(user.id);
    const tokens = await issueTokens(user, context);

    const publicUser = await AuthModel.findPublicById(user.id);
    return { user: publicUser as PublicUser, tokens };
  },

  /**
   * Refresh with rotation: the presented token is revoked and replaced. A
   * replayed (already-revoked) token is rejected rather than silently reissued.
   */
  async refresh(token: string, context: SessionContext): Promise<AuthResult> {
    verifyRefreshToken(token);

    const stored = await AuthModel.findActiveRefreshToken(sha256(token));
    if (!stored) throw ApiError.unauthorized('Refresh token is invalid or has been revoked');
    if (!stored.user.isActive) throw ApiError.forbidden('This account has been deactivated');

    await AuthModel.revokeRefreshToken(stored.id);

    const { isActive: _isActive, ...publicUser } = stored.user;
    const tokens = await issueTokens(
      { id: publicUser.id, email: publicUser.email, role: publicUser.role },
      context,
    );

    return { user: publicUser, tokens };
  },

  async logout(token?: string): Promise<void> {
    if (!token) return;
    const stored = await AuthModel.findActiveRefreshToken(sha256(token));
    if (stored) await AuthModel.revokeRefreshToken(stored.id);
  },

  async logoutAll(userId: string): Promise<number> {
    const { count } = await AuthModel.revokeAllForUser(userId);
    return count;
  },

  listSessions: (userId: string) => AuthModel.listSessions(userId),

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw ApiError.notFound('Session');
    await AuthModel.revokeRefreshToken(session.id);
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicUserSelect, company: true },
    });
    if (!user) throw ApiError.notFound('User');
    return user;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await AuthModel.findByIdWithPassword(userId);
    if (!user) throw ApiError.notFound('User');

    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) throw ApiError.badRequest('Your current password is incorrect');

    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw ApiError.badRequest('New password must be different from the current one');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // Force every other device to sign in again after a credential change.
    await AuthModel.revokeAllForUser(userId);

    // A "your password changed" mail is how someone finds out their account
    // was taken over, so it goes out even though they just did it themselves.
    void sendTemplatedEmail({
      to: user.email,
      event: 'auth.password_changed',
      userId: user.id,
      context: { recipientName: user.name, actionUrl: `${env.CLIENT_URL}/settings` },
    }).catch(() => undefined);
  },

  /**
   * Always resolves successfully, whether or not the email is registered —
   * the response must not reveal which addresses have accounts.
   */
  async requestPasswordReset(email: string): Promise<{ token: string | null }> {
    const user = await AuthModel.findByEmail(email);
    if (!user) return { token: null };

    const token = generateToken(32);
    await AuthModel.setResetToken(user.id, token, new Date(Date.now() + 60 * 60 * 1000));

    // Not awaited: the endpoint must answer in the same time whether or not
    // the address exists, and a slow mail provider would otherwise leak that
    // difference through response timing.
    void sendTemplatedEmail({
      to: user.email,
      event: 'auth.password_reset',
      userId: user.id,
      context: {
        recipientName: user.name,
        actionUrl: `${env.CLIENT_URL}/reset-password?token=${token}`,
      },
    }).catch(() => undefined);

    logger.info('Password reset requested', { userId: user.id });
    return { token };
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await AuthModel.findByResetToken(token);
    if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');

    await AuthModel.clearResetToken(user.id, await hashPassword(newPassword));
    await AuthModel.revokeAllForUser(user.id);

    void sendTemplatedEmail({
      to: user.email,
      event: 'auth.password_changed',
      userId: user.id,
      context: { recipientName: user.name, actionUrl: `${env.CLIENT_URL}/login` },
    }).catch(() => undefined);
  },
};

export default AuthService;
