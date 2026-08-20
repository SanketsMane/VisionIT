'use client';

import { useParams } from 'next/navigation';
import { BugDetail } from '@/components/modules/portal/bug-detail';

export default function PortalBugDetailPage() {
  const params = useParams<{ projectId: string; bugId: string }>();

  return (
    <BugDetail
      projectId={params.projectId}
      bugId={params.bugId}
      backHref={`/portal/projects/${params.projectId}/testing`}
      // Client-side users never get internal controls or notes.
      isInternal={false}
    />
  );
}
