'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { ChatShell } from '@/components/modules/chat/chat-shell';
import { workspaceApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';

/** Client-side chat: scoped to the projects they are a member of. */
export default function PortalChatPage() {
  const dashboard = useQuery({
    queryKey: queryKeys.portal.myProjects,
    queryFn: workspaceApi.myProjects,
  });

  const options = (dashboard.data?.projects ?? []).map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        description="Message the team, share files, and start a group with your colleagues."
      />
      <ChatShell projects={options} basePath="/portal/chat" />
    </div>
  );
}
