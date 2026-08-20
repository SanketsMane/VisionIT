'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { ChatShell } from '@/components/modules/chat/chat-shell';
import { projectsApi } from '@/lib/api/projects.api';
import { queryKeys } from '@/lib/hooks/query-keys';

/** Studio-side chat: every project in the workspace is a possible thread. */
export default function ChatPage() {
  const projects = useQuery({
    queryKey: queryKeys.projects.list({ limit: 100 }),
    queryFn: () => projectsApi.list({ limit: 100 }),
  });

  const options = (projects.data?.items ?? []).map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Messages"
        description="Chat with your clients and their teams, share files, and see what has been read."
      />
      <ChatShell projects={options} basePath="/chat" />
    </div>
  );
}
