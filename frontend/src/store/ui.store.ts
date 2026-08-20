'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

/** Resolves 'system' against the OS preference and stamps the class on <html>. */
const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      sidebarCollapsed: false,

      setTheme(theme) {
        applyTheme(theme);
        set({ theme });
      },

      toggleSidebar() {
        set({ sidebarCollapsed: !get().sidebarCollapsed });
      },

      setSidebarCollapsed(sidebarCollapsed) {
        set({ sidebarCollapsed });
      },
    }),
    {
      name: 'vii-ui',
      onRehydrateStorage: () => (state) => {
        // Re-apply after hydration so a reload keeps the chosen theme.
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

export { applyTheme };
export type { Theme };
