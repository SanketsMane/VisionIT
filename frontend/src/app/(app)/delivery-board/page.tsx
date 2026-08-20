'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PackageCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { DeliveryBadge } from '@/components/shared/portal-badges';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';

export default function DeliveryBoardPage() {
  const board = useQuery({
    queryKey: queryKeys.portal.deliveryBoard,
    queryFn: workspaceApi.deliveryBoard,
  });

  const items = board.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery board"
        description="Handover status across every project that has started delivery."
      />

      <Card>
        {board.isError ? (
          <ErrorState onRetry={() => void board.refetch()} />
        ) : board.isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="No deliveries in progress"
            description="Open a project's Delivery tab to start its handover."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Delivery status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Confirmations</TableHead>
                <TableHead>Target date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((project) => (
                <TableRow key={project.id} interactive>
                  <TableCell>
                    <Link href={`/projects/${project.id}/delivery`} className="block group">
                      {project.code && (
                        <span className="font-mono text-[10px] text-muted-foreground">{project.code}</span>
                      )}
                      <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">
                        {project.title}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell><DeliveryBadge status={project.delivery.status} size="sm" /></TableCell>
                  <TableCell className="font-mono text-xs">
                    {project.delivery.version ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge
                        variant={project.delivery.adminConfirmedAt ? 'success' : 'outline'}
                        size="sm"
                      >
                        Studio
                      </Badge>
                      <Badge
                        variant={project.delivery.clientConfirmedAt ? 'success' : 'outline'}
                        size="sm"
                      >
                        Client
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(project.endDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
