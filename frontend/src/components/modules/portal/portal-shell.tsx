'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Bug, FileText, FolderOpen, LayoutGrid, LogOut, Menu,
  Monitor, Moon, PackageCheck, Receipt, Sun, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NotificationBell } from '@/components/layout/notification-bell';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore, type Theme } from '@/store/ui.store';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { cn } from '@/lib/utils';

const PROJECT_NAV = [
  { segment: '', label: 'Overview', icon: LayoutGrid },
  { segment: 'testing', label: 'Testing', icon: Bug },
  { segment: 'invoices', label: 'Invoices', icon: FileText },
  { segment: 'payments', label: 'Payments', icon: Receipt },
  { segment: 'documents', label: 'Documents', icon: FolderOpen },
  { segment: 'delivery', label: 'Delivery', icon: PackageCheck },
  { segment: 'team', label: 'Team', icon: Users },
  { segment: 'activity', label: 'Activity', icon: Activity },
] as const;

/**
 * The client portal shell.
 *
 * Deliberately a different chrome from the studio app: a client should never
 * see studio navigation, and an internal user landing here is redirected back
 * rather than shown a half-working portal.
 */
export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const projectId = params?.projectId;

  const isReady = useAuthStore((s) => s.isReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    // Studio staff belong in the studio app, not the client portal.
    if (user?.userType === 'INTERNAL') router.replace('/dashboard');
  }, [isReady, isAuthenticated, user, router]);

  const dashboard = useQuery({
    queryKey: queryKeys.portal.myProjects,
    queryFn: workspaceApi.myProjects,
    enabled: isAuthenticated && user?.userType === 'CLIENT',
  });

  if (!isReady || !isAuthenticated || user?.userType === 'INTERNAL') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const activeProject = dashboard.data?.projects.find((p) => p.id === projectId);
  const studio = dashboard.data?.studio;
  const hasSingleProject = dashboard.data?.projects.length === 1;

  const themeIcons: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
  const ThemeIcon = themeIcons[theme];

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    router.push('/login');
  };

  const isActive = (segment: string) => {
    if (!projectId) return false;
    const base = `/portal/projects/${projectId}`;
    return segment === '' ? pathname === base : pathname.startsWith(`${base}/${segment}`);
  };

  const nav = projectId ? (
    <nav className="space-y-0.5">
      {PROJECT_NAV.map((item) => (
        <Link
          key={item.segment}
          href={`/portal/projects/${projectId}${item.segment ? `/${item.segment}` : ''}`}
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
            isActive(item.segment)
              ? 'bg-primary-muted text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <item.icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  ) : null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        {studio?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={studio.logoUrl} alt="" className="h-8 w-auto max-w-[140px] object-contain" />
        ) : (
          <Image src="/logo-mark.png" alt="" width={64} height={64} className="size-8 object-contain" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{studio?.name ?? 'Client portal'}</p>
          <p className="text-[10px] text-muted-foreground">Client portal</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-slim p-3">
        {/* Hidden for a single-project client: /portal redirects straight back
            to their project, so the link would look broken. */}
        {!hasSingleProject && (
          <Link
            href="/portal"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'mb-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              pathname === '/portal'
                ? 'bg-primary-muted text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <LayoutGrid className="size-4" />
            My projects
          </Link>
        )}

        {activeProject && (
          <>
            <div className="mb-2 rounded-lg border border-border bg-muted/40 p-3">
              <p className="truncate text-xs font-semibold">{activeProject.title}</p>
              {activeProject.code && (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {activeProject.code}
                </p>
              )}
              <Badge variant="primary" size="sm" className="mt-1.5">{activeProject.roleLabel}</Badge>
            </div>
            {nav}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:block">{sidebar}</aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          size="sm"
          className="left-0 top-0 h-dvh max-h-dvh w-60 translate-x-0 translate-y-0 overflow-hidden rounded-none p-0"
        >
          {sidebar}
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {activeProject?.title ?? 'My projects'}
            </p>
          </div>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Theme"><ThemeIcon /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setTheme('light')}><Sun /> Light</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme('dark')}><Moon /> Dark</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme('system')}><Monitor /> System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void handleLogout()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-slim">
          <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
