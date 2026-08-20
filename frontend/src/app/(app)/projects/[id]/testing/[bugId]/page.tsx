'use client';

import { useParams } from 'next/navigation';
import { BugDetail } from '@/components/modules/portal/bug-detail';

export default function AdminBugDetailPage() {
  const params = useParams<{ id: string; bugId: string }>();
  return (
    <BugDetail
      projectId={params.id}
      bugId={params.bugId}
      backHref={`/projects/${params.id}/testing`}
      // Studio side: triage controls and internal notes are available here.
      isInternal
    />
  );
}
