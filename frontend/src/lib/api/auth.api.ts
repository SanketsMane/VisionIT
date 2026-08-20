import { del, get, patch, post, setAccessToken } from './client';
import type { User } from '@/types';

export interface AuthResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export const authApi = {
  /**
   * No UI calls this: sign-up is closed and /register redirects to /login.
   * Kept because the endpoint still exists behind ALLOW_PUBLIC_REGISTRATION,
   * so re-opening sign-up is a matter of restoring the page, not rewriting
   * the client.
   */
  /**
   * Starts a "view as client" session. The returned token replaces the studio
   * one in memory; the refresh cookie is untouched, so the real session is
   * still underneath and a reload returns to it.
   */
  async impersonate(userId: string) {
    const data = await post<{
      accessToken: string;
      expiresIn: number;
      user: User;
      impersonating: true;
      actor: { id: string; name: string };
    }>(`/auth/impersonate/${userId}`);
    setAccessToken(data.accessToken);
    return data;
  },

  async stopImpersonating() {
    const data = await post<AuthResponse>('/auth/stop-impersonating');
    setAccessToken(data.accessToken);
    return data;
  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const data = await post<AuthResponse>('/auth/register', payload);
    setAccessToken(data.accessToken);
    return data;
  },

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const data = await post<AuthResponse>('/auth/login', payload);
    setAccessToken(data.accessToken);
    return data;
  },

  /**
   * Called once on app boot to turn the httpOnly refresh cookie into an
   * in-memory access token. `skipAuthRefresh` stops the 401 interceptor from
   * recursing back into this same endpoint when there is no valid session.
   */
  async restoreSession(): Promise<AuthResponse> {
    const data = await post<AuthResponse>('/auth/refresh', {}, { skipAuthRefresh: true } as never);
    setAccessToken(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    await post('/auth/logout');
    setAccessToken(null);
  },

  logoutAll: () => post<{ revokedSessions: number }>('/auth/logout-all'),
  me: () => get<User>('/auth/me'),
  sessions: () => get<Session[]>('/auth/sessions'),
  revokeSession: (id: string) => del<null>(`/auth/sessions/${id}`),

  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => patch<null>('/auth/change-password', payload),

  forgotPassword: (email: string) => post<{ resetToken?: string } | null>('/auth/forgot-password', { email }),

  resetPassword: (payload: { token: string; newPassword: string; confirmPassword: string }) =>
    post<null>('/auth/reset-password', payload),
};
