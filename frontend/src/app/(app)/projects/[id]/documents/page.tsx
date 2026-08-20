'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Field, FieldRow } from '@/components/shared/form-field';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { VisibilityBadge } from '@/components/shared/portal-badges';
import { ProjectWorkspaceTabs } from '@/components/modules/portal/project-tabs';
import { documentsApi } from '@/lib/api/portal.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatFileSize, humanize } from '@/lib/format';
import type { DocumentCategory, DocumentVisibility } from '@/types/portal';

const CATEGORIES: DocumentCategory[] = [
  'PROPOSAL', 'AGREEMENT', 'SOW', 'REQUIREMENTS', 'DESIGN', 'TECHNICAL_DOC',
  'USER_DOC', 'TESTING_REPORT', 'DEPLOYMENT_DOC', 'CREDENTIALS', 'FINAL_REPORT',
  'INVOICE', 'RECEIPT', 'BUILD', 'SOURCE_CODE', 'OTHER',
];

export default function AdminProjectDocumentsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);

  const query = useMemo(
    () => ({
      page, limit: 50,
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

  const { onSuccess, onError } = useMutationHandlers();

  const toggleVisibility = useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: DocumentVisibility }) =>
      documentsApi.update(projectId, id, { visibility }),
    onSuccess: (doc) =>
      onSuccess(
        doc.visibility === 'CLIENT_VISIBLE'
          ? 'Shared with the client'
          : 'Hidden from the client',
        [['portal', 'documents']],
      ),
    onError: (error) => onError(error, 'Could not change visibility'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => documentsApi.remove(projectId, id),
    onSuccess: () => onSuccess('Document deleted', [['portal', 'documents']]),
    onError: (error) => onError(error, 'Could not delete'),
  });

  const download = useMutation({
    mutationFn: ({ id, filename }: { id: string; filename: string }) =>
      documentsApi.download(projectId, id, filename),
    onError: (error) => onError(error, 'Could not download'),
  });

  const items = documents.data?.items ?? [];

  return (
    <div className="space-y-6">
      <ProjectWorkspaceTabs projectId={projectId} active="documents" />

      <PageHeader
        title="Project documents"
        description="Contracts, specs and reports. You choose which the client can see."
        actions={<Button onClick={() => setUploadOpen(true)}><Upload /> Upload</Button>}
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
            description="Upload contracts, specs and reports. Mark them client-visible to share."
            action={<Button size="sm" onClick={() => setUploadOpen(true)}><Upload /> Upload</Button>}
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
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="sm">{humanize(document.category)}</Badge>
                    <VisibilityBadge visibility={document.visibility} />
                    {document.version && <Badge variant="info" size="sm">{document.version}</Badge>}
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(document.sizeBytes)} · {formatDate(document.createdAt)}
                      {document.downloadCount > 0 ? ` · ${document.downloadCount} download(s)` : ''}
                    </span>
                  </div>
                </div>

                <label className="hidden items-center gap-2 sm:flex">
                  <Switch
                    checked={document.visibility === 'CLIENT_VISIBLE'}
                    onCheckedChange={(checked) =>
                      toggleVisibility.mutate({
                        id: document.id,
                        visibility: checked ? 'CLIENT_VISIBLE' : 'ADMIN_ONLY',
                      })
                    }
                  />
                  <span className="text-[10px] text-muted-foreground">Share</span>
                </label>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => download.mutate({ id: document.id, filename: document.filename })}
                  aria-label="Download"
                >
                  <Download />
                </Button>

                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Delete">
                      <Trash2 className="text-danger" />
                    </Button>
                  }
                  title={`Delete "${document.name}"?`}
                  description="The file is removed permanently."
                  confirmLabel="Delete"
                  onConfirm={() => remove.mutateAsync(document.id)}
                />
              </li>
            ))}
          </ul>
        )}

        <Pagination meta={documents.data?.meta} onPageChange={setPage} label="documents" />
      </Card>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} projectId={projectId} />
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { onSuccess, onError } = useMutationHandlers();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('OTHER');
  const [version, setVersion] = useState('');
  const [visibility, setVisibility] = useState<DocumentVisibility>('ADMIN_ONLY');
  const [allowDownload, setAllowDownload] = useState(true);

  const upload = useMutation({
    mutationFn: () =>
      documentsApi.upload(projectId, {
        file: file!,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        category,
        version: version.trim() || undefined,
        visibility,
        allowDownload,
      }),
    onSuccess: () => {
      onSuccess('Document uploaded', [['portal', 'documents'], queryKeys.portal.workspace(projectId)]);
      setFile(null); setName(''); setDescription(''); setVersion('');
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not upload the document'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            Stored privately. Only client-visible documents appear in the portal.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Field label="File" required>
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="truncate text-xs">{file.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-xs text-muted-foreground transition-colors hover:bg-accent">
                <Upload className="size-4" />
                Choose a file
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0] ?? null;
                    setFile(chosen);
                    if (chosen && !name) setName(chosen.name.replace(/\.[^.]+$/, ''));
                  }}
                />
              </label>
            )}
          </Field>

          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Signed agreement" />
          </Field>

          <Field label="Description">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <FieldRow>
            <Field label="Category">
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>{humanize(value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Version">
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0" />
            </Field>
          </FieldRow>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-xs font-medium">Share with the client</p>
              <p className="text-[11px] text-muted-foreground">
                Off means only your team can see it — the client is never told it exists.
              </p>
            </div>
            <Switch
              checked={visibility === 'CLIENT_VISIBLE'}
              onCheckedChange={(checked) => setVisibility(checked ? 'CLIENT_VISIBLE' : 'ADMIN_ONLY')}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-xs font-medium">Allow download</p>
              <p className="text-[11px] text-muted-foreground">Off makes it view-only for the client.</p>
            </div>
            <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
          </label>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!file} loading={upload.isPending} onClick={() => upload.mutate()}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
