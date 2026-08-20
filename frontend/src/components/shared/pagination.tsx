'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/lib/api/client';
import { formatNumber } from '@/lib/format';

export function Pagination({
  meta,
  onPageChange,
  label = 'records',
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (!meta || meta.total === 0) return null;

  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground tabular">{formatNumber(from)}</span>–
        <span className="font-medium text-foreground tabular">{formatNumber(to)}</span> of{' '}
        <span className="font-medium text-foreground tabular">{formatNumber(meta.total)}</span> {label}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={!meta.hasPrevPage}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>

        <span className="px-2 text-xs text-muted-foreground tabular">
          {meta.page} / {meta.totalPages}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={!meta.hasNextPage}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
