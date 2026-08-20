'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PackageCheck, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { ServiceIcon } from '@/components/modules/services/service-icon';
import { ORDER_STATUS_LABELS, ordersApi, type ServiceOrderStatus } from '@/lib/api/services.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { formatDate } from '@/lib/format';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export const STATUS_TONE: Record<ServiceOrderStatus, 'warning' | 'primary' | 'info' | 'success' | 'danger' | 'outline'> = {
  QUOTE_REQUESTED: 'warning',
  QUOTED: 'primary',
  AWAITING_PAYMENT: 'warning',
  PAYMENT_SUBMITTED: 'info',
  ACTIVE: 'success',
  REJECTED: 'danger',
  CANCELLED: 'outline',
};

export default function MyOrdersPage() {
  const orders = useQuery({ queryKey: queryKeys.services.myOrders, queryFn: ordersApi.mine });
  const items = orders.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My orders"
        description="Everything you have ordered, and where each one stands."
        actions={
          <Button asChild><Link href="/portal/services"><Plus /> Order a service</Link></Button>
        }
      />

      {orders.isError ? (
        <Card><ErrorState onRetry={() => void orders.refetch()} /></Card>
      ) : orders.isLoading ? (
        <Card><TableSkeleton rows={4} columns={4} /></Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title="No orders yet"
            description="Browse the services to get started."
            className="py-16"
            action={<Button asChild><Link href="/portal/services">Browse services</Link></Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((order) => (
            <Link key={order.id} href={`/portal/services/orders/${order.id}`}>
              <Card className="transition-shadow hover:shadow-soft">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-lg"
                    style={{
                      backgroundColor: `${order.service.accentColor ?? '#0076FF'}18`,
                      color: order.service.accentColor ?? '#0076FF',
                    }}
                  >
                    <ServiceIcon name={order.service.icon} className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {order.service.name}
                      {order.plan && <span className="text-muted-foreground"> · {order.plan.name}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {order.orderNumber} · {formatDate(order.createdAt)}
                      {order.termMonths ? ` · ${order.termMonths} months` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {order.finalPrice ? `${rupees(order.finalPrice)}${order.termMonths ? '/mo' : ''}` : '—'}
                    </p>
                    <Badge variant={STATUS_TONE[order.status]} size="sm">
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
