'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileText, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { documentsApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatFileSize, humanize } from '@/lib/format';
import type { DocumentCategory } from '@/types/portal';

const CATEGORIES: DocumentCategory[] = [
  'PROPOSAL', 'AGREEMENT', 'SOW', 'REQUIREMENTS', 'DESIGN', 'TECHNICAL_DOC',
  'USER_DOC', 'TESTING_REPORT', 'DEPLOYMENT_DOC', 'CREDENTIALS', 'FINAL_REPORT',
  'INVOICE', 'RECEIPT', 'BUILD', 'SOURCE_CODE', 'OTHER',
];

export default function PortalDocumentsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');

  const query = useMemo(
    () => ({
      page,
      limit: 50,
      search: search || undefined,
      category: category === 'all' ? undefined : category,
    }),
    [page, search, category],
  );

  const documents = useQuery({
    queryKey: queryKeys.portal.documents(projectId, query),
    queryFn: () => documentsApi.list(projectId, query),
    enabled: Boolean(projectId),
  });

  const { onError } = useMutationHandlers();

  const download = useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      documentsApi.download(projectId, id, filename),
    onError: (error) => onError(error, 'Could not download the document'),
  });

  const items = documents.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Contracts, specs, reports and everything else shared with you."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search documents…"
            className="sm:max-w-xs"
          />
          <Select value={category} onValueChange={(v) => { setCategory(v as DocumentCategory | 'all'); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {documents.isError ? (
          <ErrorState onRetry={() => void documents.refetch()} />
        ) : documents.isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Documents shared by the team will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((document) => (
              <li key={document.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.name}</p>
                  {document.description && (
                    <p className="truncate text-[11px] text-muted-foreground">{document.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="sm">{humanize(document.category)}</Badge>
                    {document.version && <Badge variant="info" size="sm">{document.version}</Badge>}
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(document.sizeBytes)} · {formatDate(document.createdAt)}
                    </span>
                  </div>
                </div>

                {document.allowDownload ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={
                      download.isPending && download.variables?.id === document.id
                    }
                    onClick={() =>
                      download.mutate({ id: document.id, filename: document.filename })
                    }
                  >
                    <Download /> Download
                  </Button>
                ) : (
                  <Badge variant="outline" size="sm">View only</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        <Pagination meta={documents.data?.meta} onPageChange={setPage} label="documents" />
      </Card>
    </div>
  );
}
