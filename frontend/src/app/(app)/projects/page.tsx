'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Briefcase, ExternalLink, GitBranch, LayoutGrid, List, MoreVertical,
  Pencil, Plus, Smartphone, Star, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { SearchInput } from '@/components/shared/search-input';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { CATEGORY_LABELS, CategoryBadge, ProjectStatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ProjectFormDialog } from '@/components/modules/projects/project-form';
import { projectsApi, type ProjectListParams } from '@/lib/api/projects.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Project, ProjectCategory, ProjectStatus } from '@/types';

const STATUSES: ProjectStatus[] = [
  'LEAD', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'MAINTENANCE', 'CANCELLED',
];

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProjectCategory | 'all'>('all');
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  // `?new=1` from the global Create menu opens the form straight away.
  useEffect(() => {
    if (searchParams.get('new')) {
      setEditing(null);
      setFormOpen(true);
      router.replace('/projects');
    }
  }, [searchParams, router]);

  const params: ProjectListParams = useMemo(
    () => ({
      page,
      limit: 12,
      search: search || undefined,
      category: category === 'all' ? undefined : category,
      status: status === 'all' ? undefined : status,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    [page, search, category, status],
  );

  const projects = useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: () => projectsApi.list(params),
  });

  const stats = useQuery({
    queryKey: queryKeys.projects.stats,
    queryFn: projectsApi.stats,
  });

  const { onSuccess, onError } = useMutationHandlers();

  const remove = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => onSuccess('Project removed', [queryKeys.projects.all]),
    onError: (error) => onError(error, 'Could not remove the project'),
  });

  // Any filter change invalidates the current page number.
  const resetAnd = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const items = projects.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Your catalog of shipped and in-flight work."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Add project
          </Button>
        }
      />

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total projects</p>
            <p className="mt-1 text-xl font-semibold tabular">{formatNumber(stats.data.total)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Contract value</p>
            <p className="mt-1 text-xl font-semibold">
              <Money value={stats.data.totalContractValue} compact />
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Hours logged</p>
            <p className="mt-1 text-xl font-semibold tabular">{formatNumber(stats.data.totalLoggedHours)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">In progress</p>
            <p className="mt-1 text-xl font-semibold tabular">
              {formatNumber(stats.data.byStatus.find((s) => s.status === 'IN_PROGRESS')?.count ?? 0)}
            </p>
          </Card>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={resetAnd(setSearch)}
            placeholder="Search projects, tags, descriptions…"
            className="lg:max-w-xs"
          />

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Select value={category} onValueChange={resetAnd((v) => setCategory(v as ProjectCategory | 'all'))}>
              <SelectTrigger className="w-auto min-w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as ProjectCategory[]).map((key) => (
                  <SelectItem key={key} value={key}>{CATEGORY_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={resetAnd((v) => setStatus(v as ProjectStatus | 'all'))}>
              <SelectTrigger className="w-auto min-w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(search || category !== 'all' || status !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); setPage(1); }}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex rounded-lg bg-muted p-0.5">
            {([['grid', LayoutGrid], ['table', List]] as const).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  view === key ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-label={`${key} view`}
                aria-pressed={view === key}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>

        {projects.isError ? (
          <ErrorState
            message={projects.error instanceof Error ? projects.error.message : undefined}
            onRetry={() => void projects.refetch()}
          />
        ) : projects.isLoading ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-56 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No projects match"
            description={
              search || category !== 'all' || status !== 'all'
                ? 'Try loosening the filters, or add a new project.'
                : 'Start cataloging your work — every project you add becomes part of your portfolio.'
            }
            action={
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus /> Add project
              </Button>
            }
          />
        ) : view === 'grid' ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => { setEditing(project); setFormOpen(true); }}
                onDelete={() => remove.mutateAsync(project.id)}
              />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((project) => (
                <TableRow key={project.id} interactive onClick={() => router.push(`/projects/${project.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {project.featured && <Star className="size-3 shrink-0 fill-warning text-warning" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{project.title}</p>
                        {project.summary && (
                          <p className="truncate text-[11px] text-muted-foreground">{project.summary}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {project.client?.companyName ?? project.client?.name ?? '—'}
                  </TableCell>
                  <TableCell><CategoryBadge category={project.category} /></TableCell>
                  <TableCell><ProjectStatusBadge status={project.status} /></TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {project.contractValue ? (
                      <Money value={project.contractValue} currency={project.currency} compact />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground tabular">
                    {formatDate(project.startDate, 'short')} → {formatDate(project.endDate, 'short')}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <RowActions
                      project={project}
                      onEdit={() => { setEditing(project); setFormOpen(true); }}
                      onDelete={() => remove.mutateAsync(project.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Pagination meta={projects.data?.meta} onPageChange={setPage} label="projects" />
      </Card>

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />
    </div>
  );
}

function RowActions({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => Promise<unknown>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Project actions">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${project.id}`}>Open</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}><Pencil /> Edit</DropdownMenuItem>
        {project.liveUrl && (
          <DropdownMenuItem asChild>
            <a href={project.liveUrl} target="_blank" rel="noreferrer"><ExternalLink /> Live site</a>
          </DropdownMenuItem>
        )}
        <ConfirmDialog
          trigger={
            <button
              type="button"
              className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-danger outline-none transition-colors hover:bg-danger-muted [&_svg]:size-3.5"
            >
              <Trash2 /> Delete
            </button>
          }
          title="Delete this project?"
          description={`"${project.title}" will be removed from your catalog. Invoices already raised against it are kept.`}
          confirmLabel="Delete project"
          onConfirm={onDelete}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => Promise<unknown>;
}) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-raised">
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverImageUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="size-full"
            // A deterministic gradient beats an empty grey box when there is
            // no cover image, and keeps each card visually distinguishable.
            style={{
              backgroundImage:
                'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 22%, transparent), color-mix(in srgb, var(--color-chart-2) 18%, transparent))',
            }}
          />
        )}

        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <CategoryBadge category={project.category} />
          {project.featured && (
            <Badge variant="warning" className="gap-1">
              <Star className="size-2.5 fill-current" /> Featured
            </Badge>
          )}
        </div>

        <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <RowActions project={project} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        <Link href={`/projects/${project.id}`} className="group/link">
          <h3 className="line-clamp-1 text-sm font-semibold transition-colors group-hover/link:text-primary">
            {project.title}
          </h3>
        </Link>

        {project.summary && (
          <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
            {project.summary}
          </p>
        )}

        {project.technologies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {project.technologies.slice(0, 4).map((tech) => (
              <Badge key={tech.id} variant="outline" size="sm">{tech.name}</Badge>
            ))}
            {project.technologies.length > 4 && (
              <Badge variant="outline" size="sm">+{project.technologies.length - 4}</Badge>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">
              {project.client?.companyName ?? project.client?.name ?? 'Internal'}
            </p>
            {project.contractValue ? (
              <p className="text-xs font-semibold">
                <Money value={project.contractValue} currency={project.currency} compact />
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Repository"
              >
                <GitBranch className="size-3.5" />
              </a>
            )}
            {(project.playStoreUrl || project.appStoreUrl) && (
              <a
                href={project.playStoreUrl ?? project.appStoreUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="App listing"
              >
                <Smartphone className="size-3.5" />
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Live site"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
            <ProjectStatusBadge status={project.status} size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
