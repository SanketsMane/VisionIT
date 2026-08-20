'use client';

import { create } from 'zustand';
import { authApi } from '@/lib/api/auth.api';
import { setAccessToken, setUnauthenticatedHandler } from '@/lib/api/client';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** False until the initial session-restore attempt has settled. */
  isReady: boolean;
  isAuthenticated: boolean;

  /**
   * Set while the studio is viewing the portal as a client. Deliberately not
   * persisted: the impersonation token lives in memory only, so a reload falls
   * back to the refresh cookie and lands on the studio session again. Keeping
   * a flag in storage would leave a banner claiming an impersonation that the
   * token no longer supports.
   */
  impersonation: { actorName: string; clientName: string } | null;

  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: {
    name: string; email: string; password: string;
    companyName?: string; phone?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  impersonate: (userId: string) => Promise<User>;
  stopImpersonating: () => Promise<User>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isReady: false,
  isAuthenticated: false,
  impersonation: null,

  /**
   * Exchanges the httpOnly refresh cookie for an access token on app boot.
   * A failure here is the normal "not signed in" path, not an error worth
   * surfacing — so it resolves quietly and just leaves the store empty.
   */
  async restore() {
    try {
      const { user } = await authApi.restoreSession();
      set({ user, isAuthenticated: true, isReady: true, impersonation: null });
    } catch {
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isReady: true, impersonation: null });
    }
  },

  async login(email, password) {
    const { user } = await authApi.login({ email, password });
    set({ user, isAuthenticated: true, isReady: true });
    return user;
  },

  async register(payload) {
    const { user } = await authApi.register(payload);
    set({ user, isAuthenticated: true, isReady: true });
    return user;
  },

  async logout() {
    try {
      await authApi.logout();
    } finally {
      // Clear local state even if the server call failed — the user asked to
      // sign out, and leaving them "logged in" would be worse than a stale
      // server-side session that expires on its own.
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, impersonation: null });
    }
  },

  setUser(user) {
    set({ user, isAuthenticated: Boolean(user) });
  },

  async impersonate(userId) {
    const data = await authApi.impersonate(userId);
    set({
      user: data.user,
      isAuthenticated: true,
      isReady: true,
      impersonation: { actorName: data.actor.name, clientName: data.user.name },
    });
    return data.user;
  },

  async stopImpersonating() {
    const { user } = await authApi.stopImpersonating();
    set({ user, isAuthenticated: true, isReady: true, impersonation: null });
    return user;
  },
}));

/**
 * Lets the axios interceptor clear auth state when a refresh finally fails,
 * without the API layer importing the store (which would be a cycle).
 */
setUnauthenticatedHandler(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});
