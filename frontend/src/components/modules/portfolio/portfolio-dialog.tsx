'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { portfolioApi, type PortfolioItem, type WorkCategory } from '@/lib/api/leads.api';
import { WORK_CATEGORY_LABELS } from '@/lib/api/public.api';
import { projectsApi } from '@/lib/api/projects.api';
import { ApiRequestError } from '@/lib/api/client';

const EMPTY = {
  title: '', slug: '', tagline: '', summary: '',
  category: 'WEB_DEVELOPMENT' as WorkCategory,
  industry: '', liveUrl: '', coverImage: '',
  techStack: '', highlights: '', gallery: '',
  deliveredAt: '', clientLabel: '', testimonial: '',
  isFeatured: false, sortOrder: 0,
  sourceProjectId: '',
};

/** Comma or newline separated text into a clean list. */
const toList = (value: string): string[] =>
  value.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);

const fromList = (value: string[] | undefined): string => (value ?? []).join(', ');

export function PortfolioDialog({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: PortfolioItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(item);

  // Projects offered as a starting point. Only fetched while the dialog is
  // open, since most sessions never open it.
  const projects = useQuery({
    queryKey: ['projects', 'for-portfolio'],
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: open && !isEdit,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      item
        ? {
            title: item.title,
            slug: item.slug,
            tagline: item.tagline,
            summary: item.summary,
            category: item.category,
            industry: item.industry ?? '',
            liveUrl: item.liveUrl ?? '',
            coverImage: item.coverImage ?? '',
            techStack: fromList(item.techStack),
            highlights: fromList(item.highlights),
            gallery: fromList(item.gallery),
            deliveredAt: item.deliveredAt ? item.deliveredAt.slice(0, 10) : '',
            clientLabel: item.clientLabel ?? '',
            testimonial: item.testimonial ?? '',
            isFeatured: item.isFeatured,
            sortOrder: item.sortOrder,
            sourceProjectId: item.sourceProjectId ?? '',
          }
        : EMPTY,
    );
  }, [item, open]);

  const set = (key: keyof typeof form) => (value: string | boolean | number) =>
    setForm((current) => ({ ...current, [key]: value }));

  const prefill = useMutation({
    mutationFn: (projectId: string) => portfolioApi.draftFromProject(projectId),
    onSuccess: (draft) => {
      setForm((current) => ({
        ...current,
        title: draft.title ?? current.title,
        slug: draft.slug ?? current.slug,
        summary: draft.summary ?? current.summary,
        category: (draft.category as WorkCategory) ?? current.category,
        liveUrl: draft.liveUrl ?? current.liveUrl,
        coverImage: draft.coverImage ?? current.coverImage,
        techStack: fromList(draft.techStack) || current.techStack,
        gallery: fromList(draft.gallery) || current.gallery,
        deliveredAt: draft.deliveredAt ? String(draft.deliveredAt).slice(0, 10) : current.deliveredAt,
        sourceProjectId: draft.sourceProjectId,
      }));
      toast.success('Filled in from the project — the client is not carried across');
    },
    onError: () => toast.error('Could not read that project'),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        tagline: form.tagline,
        summary: form.summary,
        category: form.category,
        industry: form.industry || undefined,
        liveUrl: form.liveUrl || undefined,
        coverImage: form.coverImage || undefined,
        techStack: toList(form.techStack),
        highlights: toList(form.highlights),
        gallery: toList(form.gallery),
        deliveredAt: form.deliveredAt || undefined,
        clientLabel: form.clientLabel || undefined,
        testimonial: form.testimonial || undefined,
        isFeatured: form.isFeatured,
        sortOrder: Number(form.sortOrder) || 0,
        ...(isEdit ? {} : { sourceProjectId: form.sourceProjectId || undefined }),
      };
      return item ? portfolioApi.update(item.id, payload) : portfolioApi.create(payload);
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      toast.success(isEdit ? 'Portfolio updated' : 'Added to your portfolio');
    },
    onError: (error) =>
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save that'),
  });

  const canSave = form.title.trim().length >= 2 && form.tagline.trim().length >= 3 && form.summary.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${item?.title}` : 'Add work'}</DialogTitle>
          <DialogDescription>
            This is what the website shows. The client is never named unless you name them here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isEdit && (
            <Field
              label="Start from a project"
              htmlFor="sourceProject"
              hint="Copies the title, link and stack across. The client is not carried over."
            >
              <div className="flex gap-2">
                <select
                  id="sourceProject"
                  value={form.sourceProjectId}
                  onChange={(e) => set('sourceProjectId')(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
                >
                  <option value="">Start from scratch</option>
                  {(projects.data?.items ?? []).map((project) => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!form.sourceProjectId || prefill.isPending}
                  onClick={() => prefill.mutate(form.sourceProjectId)}
                >
                  {prefill.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />}
                  Fill in
                </Button>
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="title" required>
              <Input id="title" value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder="Project name" />
            </Field>
            <Field label="Link" htmlFor="slug" hint="Leave blank to derive from the title">
              <Input id="slug" value={form.slug} onChange={(e) => set('slug')(e.target.value)} placeholder="project-name" />
            </Field>
          </div>

          <Field label="Tagline" htmlFor="tagline" required hint="One line, shown on the card">
            <Input id="tagline" value={form.tagline} onChange={(e) => set('tagline')(e.target.value)} placeholder="What it is, in a sentence." />
          </Field>

          <Field label="Description" htmlFor="summary" required hint="Blank lines separate paragraphs">
            <textarea
              id="summary"
              value={form.summary}
              onChange={(e) => set('summary')(e.target.value)}
              rows={6}
              placeholder="What the product does, what you built, and what it achieved."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category">
              <select
                id="category"
                value={form.category}
                onChange={(e) => set('category')(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-primary"
              >
                {(Object.keys(WORK_CATEGORY_LABELS) as WorkCategory[]).map((value) => (
                  <option key={value} value={value}>{WORK_CATEGORY_LABELS[value]}</option>
                ))}
              </select>
            </Field>
            <Field label="Industry" htmlFor="industry" hint="Optional">
              <Input id="industry" value={form.industry} onChange={(e) => set('industry')(e.target.value)} placeholder="Logistics, fintech, retail…" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Live URL" htmlFor="liveUrl" hint="Optional">
              <Input id="liveUrl" value={form.liveUrl} onChange={(e) => set('liveUrl')(e.target.value)} placeholder="https://example.com" />
            </Field>
            <Field label="Delivered" htmlFor="deliveredAt" hint="Only month and year are shown">
              <Input id="deliveredAt" type="date" value={form.deliveredAt} onChange={(e) => set('deliveredAt')(e.target.value)} />
            </Field>
          </div>

          <Field label="Cover image URL" htmlFor="coverImage" hint="Optional">
            <Input id="coverImage" value={form.coverImage} onChange={(e) => set('coverImage')(e.target.value)} placeholder="https://…/screenshot.png" />
          </Field>

          <Field label="Built with" htmlFor="techStack" hint="Comma separated">
            <Input id="techStack" value={form.techStack} onChange={(e) => set('techStack')(e.target.value)} placeholder="Next.js, PostgreSQL, AWS" />
          </Field>

          <Field label="What it does" htmlFor="highlights" hint="Comma or line separated — shown as bullets">
            <textarea
              id="highlights"
              value={form.highlights}
              onChange={(e) => set('highlights')(e.target.value)}
              rows={3}
              placeholder="Real-time tracking, Driver app, Automated invoicing"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
            />
          </Field>

          <div className="rounded-lg border border-warning/40 bg-warning-muted/40 p-3.5">
            <p className="text-xs font-medium">Naming the client</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Both fields below are blank by default and stay off the site unless you fill them in.
              Ask the client first.
            </p>
            <div className="mt-3 space-y-3">
              <Field label="Client label" htmlFor="clientLabel" hint="Optional">
                <Input id="clientLabel" value={form.clientLabel} onChange={(e) => set('clientLabel')(e.target.value)} placeholder="e.g. Founder, Acme Logistics" />
              </Field>
              <Field label="Testimonial" htmlFor="testimonial" hint="Optional">
                <textarea
                  id="testimonial"
                  value={form.testimonial}
                  onChange={(e) => set('testimonial')(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-primary"
                />
              </Field>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => set('isFeatured')(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Feature this — pinned to the front of the list
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : isEdit ? 'Save changes' : 'Add work'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
