'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Menu, Monitor, Moon, Plus, Settings, Sun, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore, type Theme } from '@/store/ui.store';
import { NotificationBell } from './notification-bell';
import { ALL_NAV_ITEMS } from './nav-config';

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  const current = ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    router.push('/login');
  };

  const themeIcons: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
  const ThemeIcon = themeIcons[theme];

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open menu">
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{current?.label ?? 'Vision IT Infra'}</p>
        {current?.description && (
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{current.description}</p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <Plus />
            Create
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Create new</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => router.push('/invoices?new=1')}>Invoice</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/projects?new=1')}>Project</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/clients?new=1')}>Client</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/expenses?new=1')}>Expense</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push('/email?compose=1')}>Email with AI</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Theme">
            <ThemeIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTheme('light')}><Sun /> Light</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme('dark')}><Moon /> Dark</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme('system')}><Monitor /> System</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account">
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            {user?.role && <Badge variant="primary" size="sm" className="mt-1.5">{user.role}</Badge>}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings"><UserIcon /> Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings"><Settings /> Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => void handleLogout()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
