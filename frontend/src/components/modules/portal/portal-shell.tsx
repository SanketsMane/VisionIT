'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Boxes, Bug, ChevronLeft, FileText, FolderOpen, LayoutGrid, LogOut, Menu,
  MessageSquare, Monitor, Moon, PackageCheck, Receipt, ShoppingBag, Sun, Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, Tooltip, TooltipProvider } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImpersonationBanner } from '@/components/layout/impersonation-banner';
import { NotificationBell } from '@/components/layout/notification-bell';
import { useAuthStore } from '@/store/auth.store';
import { SITE } from '@/lib/site.config';
import { useUiStore, type Theme } from '@/store/ui.store';
import { workspaceApi } from '@/lib/api/portal.api';
import { chatApi } from '@/lib/api/chat.api';
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
  // Only website sign-ups get the Catalog tab.
  const isLead = user?.userType === 'LEAD';
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const [mobileOpen, setMobileOpen] = useState(false);
  /**
   * The project whose nav the sidebar shows.
   *
   * Global pages like Messages have no projectId in the URL, and keying the nav
   * off the URL alone made the whole sidebar collapse to one link the moment a
   * client opened their inbox. Remembering the last project keeps the chrome
   * stable while they step out of a project and back into it.
   */
  const [lastProjectId, setLastProjectId] = useState<string | undefined>(projectId);

  useEffect(() => {
    if (projectId) setLastProjectId(projectId);
  }, [projectId]);

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

  // Must sit above the early return below — a hook called conditionally shifts
  // the hook order between renders and React refuses to reconcile it.
  const unreadQuery = useQuery({
    queryKey: queryKeys.chat.unread,
    queryFn: () => chatApi.unread(),
    enabled: isAuthenticated && user?.userType === 'CLIENT',
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data?.total ?? 0;

  if (!isReady || !isAuthenticated || user?.userType === 'INTERNAL') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const projects = dashboard.data?.projects ?? [];
  // Fall back to the remembered project, then to the only one they have.
  const navProjectId = projectId ?? lastProjectId ?? (projects.length === 1 ? projects[0].id : undefined);
  const activeProject = projects.find((p) => p.id === navProjectId);
  const studio = dashboard.data?.studio;

  /**
   * What the top bar is looking at.
   *
   * The global pages have no project to name, so falling back to the project
   * label made Catalog, Services and Messages all announce "My projects".
   */
  const headerTitle =
    pathname.startsWith('/portal/catalog') ? 'Catalog'
    : pathname.startsWith('/portal/services') ? 'Services'
    : pathname.startsWith('/portal/messages') ? 'Messages'
    : activeProject?.title ?? 'My projects';
  const hasSingleProject = dashboard.data?.projects.length === 1;


  const themeIcons: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
  const ThemeIcon = themeIcons[theme];

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    router.push('/login');
  };

  const isActive = (segment: string) => {
    // Deliberately `projectId`, not `navProjectId`: on a global page nothing in
    // the project nav is the current page, and highlighting Overview there
    // would be a lie.
    if (!projectId) return false;
    const base = `/portal/projects/${projectId}`;
    return segment === '' ? pathname === base : pathname.startsWith(`${base}/${segment}`);
  };

  const nav = (collapsed: boolean) =>
    navProjectId ? (
      <nav className="space-y-0.5">
        {PROJECT_NAV.map((item) => {
          const active = isActive(item.segment);
          const link = (
            <Link
              href={`/portal/projects/${navProjectId}${item.segment ? `/${item.segment}` : ''}`}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-primary-muted text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon className={cn('size-4 shrink-0', active && 'text-primary')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          // Collapsed, the icon is the only label there is.
          return collapsed ? (
            <Tooltip key={item.segment} content={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            <div key={item.segment}>{link}</div>
          );
        })}
      </nav>
    ) : null;

  const messagesLink = (collapsed: boolean) => {
    const active = pathname.startsWith('/portal/chat');
    const link = (
      <Link
        href="/portal/chat"
        onClick={() => setMobileOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-primary-muted text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <span className="relative flex shrink-0">
          <MessageSquare className="size-4" />
          {/* Collapsed, the row has no room for a count, so the icon carries a
              small dot instead of a number that would overflow the rail. */}
          {collapsed && unread > 0 && (
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-danger ring-2 ring-card" />
          )}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 truncate">Messages</span>
            {unread > 0 && (
              <span className="grid min-w-[18px] shrink-0 place-items-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-danger-foreground">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </>
        )}
      </Link>
    );
    return collapsed ? (
      <Tooltip content={unread > 0 ? `Messages (${unread})` : 'Messages'} side="right">{link}</Tooltip>
    ) : (
      link
    );
  };

  /** A global nav item — not scoped to any one project. */
  const globalLink = (
    collapsed: boolean,
    { href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon },
  ) => {
    const active = pathname.startsWith(href);
    const link = (
      <Link
        key={href}
        href={href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
          collapsed && 'justify-center px-0',
          active ? 'bg-primary-muted text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
      </Link>
    );
    return collapsed ? <Tooltip key={href} content={label} side="right">{link}</Tooltip> : link;
  };

  const servicesLink = (collapsed: boolean) =>
    globalLink(collapsed, { href: '/portal/services', label: 'Services', icon: ShoppingBag });

  /**
   * Only for people who signed up on the website.
   *
   * An invited client came for their project, not to browse a portfolio, so
   * showing them the catalog would be noise. A lead signed up precisely to look
   * at the work, so for them it is the main event.
   */
  const catalogLink = (collapsed: boolean) =>
    isLead ? globalLink(collapsed, { href: '/portal/catalog', label: 'Catalog', icon: Boxes }) : null;

  const sidebar = (collapsed: boolean) => (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div
          className={cn(
            'flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          {studio?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={studio.logoUrl}
              alt=""
              className={cn('object-contain', collapsed ? 'size-8' : 'h-8 w-auto max-w-[140px]')}
            />
          ) : (
            <Image src="/logo-mark.png" alt="" width={64} height={64} className="size-8 shrink-0 object-contain" />
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {studio?.name ?? SITE.name}
              </p>
              <p className="text-[10px] text-muted-foreground">Client portal</p>
            </div>
          )}
        </div>

        <div className={cn('flex-1 overflow-y-auto scrollbar-slim py-3', collapsed ? 'px-2' : 'px-3')}>
        {/* Hidden for a single-project client: /portal redirects straight back
              to their project, so the link would look broken. */}
          {!hasSingleProject &&
            (() => {
              const active = pathname === '/portal';
              const link = (
                <Link
                  href="/portal"
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'mb-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-primary-muted text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <LayoutGrid className="size-4 shrink-0" />
                  {!collapsed && <span>My projects</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip content="My projects" side="right">{link}</Tooltip>
              ) : (
                link
              );
            })()}

          {!activeProject && catalogLink(collapsed)}
          {!activeProject && messagesLink(collapsed)}
          {!activeProject && servicesLink(collapsed)}

          {activeProject && (
            <>
              {/* The project card is all text, so it has nothing to show in a
                  68px rail — the nav icons below carry the navigation. */}
              {!collapsed && (
                <div className="mb-2 rounded-lg border border-border bg-muted/40 p-3">
                  <p className="truncate text-xs font-semibold">{activeProject.title}</p>
                  {activeProject.code && (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {activeProject.code}
                    </p>
                  )}
                  <Badge variant="primary" size="sm" className="mt-1.5">{activeProject.roleLabel}</Badge>
                </div>
              )}
              {/* Messages is the only item here that is not scoped to the
                  project — a client with two projects still has one inbox — so
                  it sits above the divider rather than among the sections. */}
              {catalogLink(collapsed)}
              {messagesLink(collapsed)}
              {servicesLink(collapsed)}
              <div className={cn('my-2 h-px bg-border', collapsed && 'mx-1')} />
              {nav(collapsed)}
            </>
          )}
        </div>

        {/* Only the desktop rail can be folded; the mobile drawer is always full width. */}
        <div className="hidden shrink-0 border-t border-border p-2 lg:block">
          <button
            type="button"
            onClick={toggleSidebar}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <ImpersonationBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          'hidden shrink-0 border-r border-border bg-card transition-[width] duration-200 lg:block',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        {sidebar(collapsed)}
      </aside>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent
          size="sm"
          className="left-0 top-0 h-dvh max-h-dvh w-60 translate-x-0 translate-y-0 overflow-hidden rounded-none p-0"
        >
          {/* Always expanded: this is a 240px panel, so a folded rail would
              leave a strip of empty space beside it. */}
          {sidebar(false)}
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
            <p className="truncate text-sm font-semibold">{headerTitle}</p>
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
    </div>
  );
}
