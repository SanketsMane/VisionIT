'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { RoleBadge } from '@/components/shared/portal-badges';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate, formatRelative } from '@/lib/format';

export default function PortalUsersPage() {
  const users = useQuery({
    queryKey: queryKeys.portal.clients,
    queryFn: workspaceApi.clients,
  });

  const items = users.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal users"
        description="Everyone with a client-portal login, and which projects they can reach."
      />

      <Card>
        {users.isError ? (
          <ErrorState onRetry={() => void users.refetch()} />
        ) : users.isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No portal users yet"
            description="Invite a client from a project's Team tab to give them a login."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        {!user.isActive && <Badge variant="danger" size="sm">Deactivated</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="truncate text-xs">{user.email}</p>
                    {user.phone && (
                      <p className="truncate text-[11px] text-muted-foreground">{user.phone}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.memberships.map((membership) => (
                        <Link
                          key={membership.project.id}
                          href={`/projects/${membership.project.id}/team`}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] transition-colors hover:bg-accent"
                        >
                          {membership.project.title}
                          <RoleBadge role={membership.role} size="sm" />
                        </Link>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never signed in'}
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
