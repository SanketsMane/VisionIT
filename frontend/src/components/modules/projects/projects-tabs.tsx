'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The two kinds of project, side by side.
 *
 * They are genuinely different things and the split is worth making explicit:
 * a *client project* is an engagement — it has a client, a contract value and a
 * delivery board, and nobody outside the studio ever sees it. A *catalog
 * project* is a showcase piece, and the only thing the public website reads.
 *
 * Keeping both under /projects means the answer to "where do I add the work
 * that shows on the site?" is the page you are already on.
 */
const TABS = [
  { href: '/projects', label: 'Client projects', icon: Briefcase },
  { href: '/projects/catalog', label: 'Catalog projects', icon: Sparkles },
];

export function ProjectsTabs() {
  const pathname = usePathname();

  return (
    <div
      className="flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/50 p-1"
      role="tablist"
    >
      {TABS.map((tab) => {
        // Exact match: /projects/abc123 is a client project, not the catalog.
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
