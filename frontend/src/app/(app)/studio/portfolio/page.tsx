'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Eye, EyeOff, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PortfolioDialog } from '@/components/modules/portfolio/portfolio-dialog';
import { portfolioApi, type PortfolioItem } from '@/lib/api/leads.api';
import { WORK_CATEGORY_LABELS } from '@/lib/api/public.api';
import { cn } from '@/lib/utils';

/**
 * What the website shows the world.
 *
 * Publishing is explicit and per item: a draft with no tagline written yet
 * would look broken on the public page, so nothing goes live by accident.
 */
export default function PortfolioManagerPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [creating, setCreating] = useState(false);

  const items = useQuery({ queryKey: ['portfolio'], queryFn: () => portfolioApi.list() });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    void queryClient.invalidateQueries({ queryKey: ['public', 'work'] });
  };

  const toggle = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isPublished?: boolean; isFeatured?: boolean } }) =>
      portfolioApi.update(id, body),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(
        variables.body.isPublished === undefined
          ? 'Updated'
          : variables.body.isPublished
            ? 'Published to the website'
            : 'Unpublished',
      );
    },
    onError: () => toast.error('Could not update that'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => portfolioApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Removed from your portfolio');
    },
    onError: () => toast.error('Could not remove that'),
  });

  const list = items.data?.items ?? [];
  const published = list.filter((item) => item.isPublished).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description={`What the website shows — ${published} published, ${list.length - published} draft${list.length - published === 1 ? '' : 's'}.`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add work
          </Button>
        }
      />

      {items.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => <Skeleton key={key} className="h-56 rounded-xl" />)}
        </div>
      ) : items.isError ? (
        <ErrorState onRetry={() => void items.refetch()} />
      ) : !list.length ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title="Nothing in your portfolio yet"
            description="Add the work you want the website to show. Nothing here is visible until you publish it."
            className="py-12"
            action={<Button onClick={() => setCreating(true)}><Plus /> Add work</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((item) => (
            <Card key={item.id} className={cn('flex flex-col', !item.isPublished && 'opacity-75')}>
              <CardContent className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.isFeatured && (
                        <Star className="size-3.5 fill-warning text-warning" aria-label="Featured" />
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">/{item.slug}</p>
                  </div>
                  <Badge variant={item.isPublished ? 'success' : 'default'} size="sm">
                    {item.isPublished ? 'Live' : 'Draft'}
                  </Badge>
                </div>

                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {item.tagline || (
                    <span className="italic text-warning">
                      No tagline yet — write one before publishing.
                    </span>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  <span>{WORK_CATEGORY_LABELS[item.category]}</span>
                  {item.industry && <><span aria-hidden>·</span><span>{item.industry}</span></>}
                  {item.isPublished && item.viewCount > 0 && (
                    <><span aria-hidden>·</span><span>{item.viewCount} views</span></>
                  )}
                </div>

                <div className="mt-4 flex gap-1.5 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={item.isPublished ? 'ghost' : 'primary'}
                    onClick={() => toggle.mutate({ id: item.id, body: { isPublished: !item.isPublished } })}
                    disabled={!item.isPublished && !item.tagline}
                    title={!item.isPublished && !item.tagline ? 'Write a tagline first' : undefined}
                  >
                    {item.isPublished ? <EyeOff /> : <Eye />}
                    {item.isPublished ? 'Hide' : 'Publish'}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${item.title}`}>
                        <Trash2 />
                      </Button>
                    }
                    title={`Remove ${item.title}?`}
                    description="It disappears from the website immediately. The project itself is untouched."
                    confirmLabel="Remove"
                    onConfirm={() => remove.mutate(item.id)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PortfolioDialog
        item={editing}
        open={Boolean(editing) || creating}
        onOpenChange={(next) => {
          if (!next) { setEditing(null); setCreating(false); }
        }}
        onSaved={invalidate}
      />

    </div>
  );
}
