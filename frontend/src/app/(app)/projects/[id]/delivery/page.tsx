'use client';

import { useParams } from 'next/navigation';
import { DeliveryPanel } from '@/components/modules/portal/delivery-panel';
import { ProjectWorkspaceTabs } from '@/components/modules/portal/project-tabs';

export default function AdminDeliveryPage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-6">
      <ProjectWorkspaceTabs projectId={params.id} active="delivery" />
      <DeliveryPanel projectId={params.id} isInternal />
    </div>
  );
}
