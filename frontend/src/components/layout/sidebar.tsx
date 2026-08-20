'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui.store';
import { Tooltip, TooltipProvider } from '@/components/ui/misc';
import { NAV_GROUPS } from './nav-config';

export function Sidebar({
  onNavigate,
  /**
   * Forces the full-width rail regardless of the stored preference. The mobile
   * drawer sets this: it is a 256px panel, so honouring a collapsed desktop
   * sidebar there would render a 68px strip with a gap beside it.
   */
  expanded,
}: {
  onNavigate?: () => void;
  expanded?: boolean;
}) {
  const pathname = usePathname();
  const stored = useUiStore((state) => state.sidebarCollapsed);
  const toggle = useUiStore((state) => state.toggleSidebar);
  const collapsed = expanded ? false : stored;

  /**
   * A nested route (/invoices/abc) must still light up its parent nav item —
   * but only the closest one. /projects/catalog has an item of its own, so the
   * longest matching href wins and /projects stays dim underneath it.
   */
  const activeHref = useMemo(() => {
    const matches = NAV_GROUPS.flatMap((group) => group.items)
      .map((item) => item.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length);
    return matches[0] ?? null;
  }, [pathname]);

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'flex h-full flex-col border-r border-border bg-card transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4', collapsed && 'justify-center px-2')}>
          <Image
            src="/logo-mark.png"
            alt="Vision IT Infra"
            width={64}
            height={64}
            priority
            className="size-8 shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Vision IT Infra</p>
              <p className="truncate text-[10px] text-muted-foreground">Business platform</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-slim px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
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

                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip content={item.label} side="right">
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!expanded && (
        <div className="shrink-0 border-t border-border p-2">
          <button
            type="button"
            onClick={toggle}
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
        )}
      </aside>
    </TooltipProvider>
  );
}
