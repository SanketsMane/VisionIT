'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bug, FolderOpen, LayoutGrid, PackageCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { bugsApi, workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid, segment: '' },
  { key: 'testing', label: 'Testing', icon: Bug, segment: '/testing' },
  { key: 'documents', label: 'Documents', icon: FolderOpen, segment: '/documents' },
  { key: 'delivery', label: 'Delivery', icon: PackageCheck, segment: '/delivery' },
  { key: 'team', label: 'Team', icon: Users, segment: '/team' },
  { key: 'activity', label: 'Activity', icon: Activity, segment: '/activity' },
] as const;

export type ProjectTab = (typeof TABS)[number]['key'];

/**
 * Workspace navigation for a project on the studio side. Renders live counts
 * so an admin sees where the attention is needed without opening each tab.
 */
export function ProjectWorkspaceTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: ProjectTab;
}) {
  const overview = useQuery({
    queryKey: queryKeys.portal.workspace(projectId),
    queryFn: () => workspaceApi.overview(projectId),
    enabled: Boolean(projectId),
  });

  const bugStats = useQuery({
    queryKey: queryKeys.portal.bugStats(projectId),
    queryFn: () => bugsApi.stats(projectId),
    enabled: Boolean(projectId),
  });

  const counts: Partial<Record<ProjectTab, number>> = {
    testing: bugStats.data?.open,
    documents: overview.data?.counts.documents,
    team: overview.data?.counts.members,
  };

  return (
    <div className="-mx-1 overflow-x-auto scrollbar-slim">
      <nav className="flex min-w-max gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const count = counts[tab.key];

          return (
            <Link
              key={tab.key}
              href={`/projects/${projectId}${tab.segment}`}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
              {count !== undefined && count > 0 && (
                <Badge variant={isActive ? 'primary' : 'outline'} size="sm">{count}</Badge>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
