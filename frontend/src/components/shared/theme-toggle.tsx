'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUiStore, type Theme } from '@/store/ui.store';
import { cn } from '@/lib/utils';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/**
 * "Has this rendered on the client yet?", without an effect.
 *
 * `useSyncExternalStore` takes a separate server snapshot, so it returns false
 * during SSR and true from the first client render — which is exactly the
 * question being asked. Doing it with `useState` + `useEffect` works too, but
 * costs a second render pass on every mount.
 */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Light / dark / system, in one control.
 *
 * Shared by the studio topbar, the client portal and the public site so all
 * three stay in step — the preference is one persisted value, and three copies
 * of this menu were three places for it to drift.
 *
 * The icon is held back until after hydration. The choice lives in
 * localStorage, so the server always renders `system` while the browser may
 * know better; painting the server's guess and then swapping it is a visible
 * flicker on every page load, and React logs a mismatch besides.
 */
export function ThemeToggle({
  className,
  align = 'end',
}: {
  className?: string;
  align?: 'start' | 'end' | 'center';
}) {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);

  const Icon = ICONS[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Theme: ${theme}`}
          className={cn(className)}
        >
          {mounted ? <Icon /> : <Monitor className="opacity-0" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {OPTIONS.map((option) => {
          const OptionIcon = ICONS[option.value];
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className={cn(mounted && theme === option.value && 'text-primary')}
            >
              <OptionIcon />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
