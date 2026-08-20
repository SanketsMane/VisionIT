import type { UserRole, UserType } from '@prisma/client';

/**
 * Request augmentation. `req.user` is populated by the `authenticate`
 * middleware and is therefore non-null in every handler mounted behind it.
 */
declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      email: string;
      role: UserRole;
      name: string;
      /** INTERNAL owns a workspace; CLIENT reaches projects via membership. */
      userType: UserType;
      /** For CLIENT users: the workspace they were invited into. */
      ownerId: string | null;
      /**
       * Set when an internal user is impersonating this account: the id of the
       * real person behind the request. Read from the signed token, so it can
       * be trusted for audit entries.
       */
      impersonatedBy?: string;
    }

    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
