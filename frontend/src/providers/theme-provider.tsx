'use client';

import { useEffect, type ReactNode } from 'react';
import { applyTheme, useUiStore } from '@/store/ui.store';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);

    // Follow the OS only while the user has explicitly chosen 'system'.
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return <>{children}</>;
}
