import type { User, UserRole } from '@prisma/client';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  companyName?: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'avatarUrl' | 'phone' | 'designation' | 'timezone' | 'locale' | 'emailVerified' | 'createdAt'
>;

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export interface JwtActor {
  id: string;
  email: string;
  role: UserRole;
}
