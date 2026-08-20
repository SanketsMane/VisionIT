'use client';

import { useParams } from 'next/navigation';
import { BugBoard } from '@/components/modules/portal/bug-board';
import { ProjectWorkspaceTabs } from '@/components/modules/portal/project-tabs';

export default function AdminTestingPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <ProjectWorkspaceTabs projectId={params.id} active="testing" />
      <BugBoard projectId={params.id} basePath={`/projects/${params.id}/testing`} canReport />
    </div>
  );
}
