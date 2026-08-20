'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDateTime } from '@/lib/format';

export default function PortalActivityPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [page, setPage] = useState(1);

  const query = useMemo(() => ({ page, limit: 30 }), [page]);

  const activity = useQuery({
    queryKey: queryKeys.portal.activity(projectId, query),
    queryFn: () => workspaceApi.activity(projectId, query),
    enabled: Boolean(projectId),
  });

  const items = activity.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" description="Everything that has happened on this project." />

      <Card>
        {activity.isError ? (
          <ErrorState onRetry={() => void activity.refetch()} />
        ) : activity.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Activity} title="No activity yet" />
        ) : (
          <ol className="divide-y divide-border">
            {items.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                {entry.actor ? (
                  <Avatar name={entry.actor.name} src={entry.actor.avatarUrl} size="sm" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Activity className="size-3.5" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{entry.summary}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    <Badge variant="outline" size="sm">{entry.entityType}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <Pagination meta={activity.data?.meta} onPageChange={setPage} label="entries" />
      </Card>
    </div>
  );
}
