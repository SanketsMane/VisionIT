'use client';

import { useParams } from 'next/navigation';
import { DeliveryPanel } from '@/components/modules/portal/delivery-panel';

export default function PortalDeliveryPage() {
  const params = useParams<{ projectId: string }>();
  return <DeliveryPanel projectId={params.projectId} isInternal={false} />;
}
