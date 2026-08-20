'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BugBoard } from '@/components/modules/portal/bug-board';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';

export default function PortalTestingPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const workspace = useQuery({
    queryKey: queryKeys.portal.workspace(projectId),
    queryFn: () => workspaceApi.overview(projectId),
    enabled: Boolean(projectId),
  });

  // Permissions come from the server's role resolution, not a client guess.
  const canReport = workspace.data?.access.permissions.includes('bug:create') ?? false;

  return (
    <BugBoard
      projectId={projectId}
      basePath={`/portal/projects/${projectId}/testing`}
      canReport={canReport}
    />
  );
}
