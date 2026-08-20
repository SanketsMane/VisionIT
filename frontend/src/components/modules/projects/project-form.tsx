'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogBody, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/misc';
import { Field, FieldRow, FormSection } from '@/components/shared/form-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { projectsApi } from '@/lib/api/projects.api';
import { clientsApi } from '@/lib/api/clients.api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { useMutationHandlers } from '@/lib/hooks/use-mutation-toast';
import { CATEGORY_LABELS } from '@/components/shared/status-badge';
import type { EngagementModel, Project, ProjectCategory, ProjectStatus, ProjectVisibility } from '@/types';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ProjectCategory[];
const STATUSES: ProjectStatus[] = [
  'LEAD', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'MAINTENANCE', 'CANCELLED',
];
const VISIBILITIES: ProjectVisibility[] = ['PUBLIC', 'PRIVATE', 'UNLISTED'];
const ENGAGEMENTS: EngagementModel[] = ['FIXED_PRICE', 'HOURLY', 'RETAINER', 'MILESTONE'];

interface FormValues {
  title: string;
  clientId: string;
  summary: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  engagement: EngagementModel;
  startDate: string;
  endDate: string;
  contractValue: string;
  hourlyRate: string;
  estimatedHours: string;
  currency: string;
  coverImageUrl: string;
  liveUrl: string;
  repoUrl: string;
  playStoreUrl: string;
  appStoreUrl: string;
  featured: boolean;
  challenges: string;
  solution: string;
  outcome: string;
  testimonial: string;
  testimonialAuthor: string;
}

/** ISO timestamp -> the `yyyy-MM-dd` a date input expects. */
const toDateInput = (value?: string | null): string => (value ? value.slice(0, 10) : '');

const buildDefaults = (project?: Project | null): FormValues => ({
  title: project?.title ?? '',
  clientId: project?.client?.id ?? '',
  summary: project?.summary ?? '',
  description: project?.description ?? '',
  category: project?.category ?? 'WEB_DEVELOPMENT',
  status: project?.status ?? 'IN_PROGRESS',
  visibility: project?.visibility ?? 'PUBLIC',
  engagement: project?.engagement ?? 'FIXED_PRICE',
  startDate: toDateInput(project?.startDate),
  endDate: toDateInput(project?.endDate),
  contractValue: project?.contractValue != null ? String(project.contractValue) : '',
  hourlyRate: project?.hourlyRate != null ? String(project.hourlyRate) : '',
  estimatedHours: project?.estimatedHours != null ? String(project.estimatedHours) : '',
  currency: project?.currency ?? 'INR',
  coverImageUrl: project?.coverImageUrl ?? '',
  liveUrl: project?.liveUrl ?? '',
  repoUrl: project?.repoUrl ?? '',
  playStoreUrl: project?.playStoreUrl ?? '',
  appStoreUrl: project?.appStoreUrl ?? '',
  featured: project?.featured ?? false,
  challenges: project?.challenges ?? '',
  solution: project?.solution ?? '',
  outcome: project?.outcome ?? '',
  testimonial: project?.testimonial ?? '',
  testimonialAuthor: project?.testimonialAuthor ?? '',
});

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}) {
  const isEdit = Boolean(project);
  const { onSuccess, onError } = useMutationHandlers();

  const [tags, setTags] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [techDraft, setTechDraft] = useState('');

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: buildDefaults(project),
  });

  // Re-seed on open so switching between "edit A" and "edit B" without an
  // unmount still shows the right record.
  useEffect(() => {
    if (!open) return;
    reset(buildDefaults(project));
    setTags(project?.tags ?? []);
    setTechnologies(project?.technologies?.map((tech) => tech.name) ?? []);
    setTagDraft('');
    setTechDraft('');
  }, [open, project, reset]);

  const clients = useQuery({
    queryKey: queryKeys.clients.list({ limit: 100 }),
    queryFn: () => clientsApi.list({ limit: 100 }),
    enabled: open,
  });

  const knownTech = useQuery({
    queryKey: queryKeys.projects.technologies,
    queryFn: projectsApi.technologies,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title.trim(),
        clientId: values.clientId || null,
        summary: values.summary.trim() || null,
        description: values.description.trim() || null,
        category: values.category,
        status: values.status,
        visibility: values.visibility,
        engagement: values.engagement,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        // Empty numeric inputs must clear the field, not send NaN.
        contractValue: values.contractValue ? Number(values.contractValue) : null,
        hourlyRate: values.hourlyRate ? Number(values.hourlyRate) : null,
        estimatedHours: values.estimatedHours ? Number(values.estimatedHours) : null,
        currency: values.currency,
        coverImageUrl: values.coverImageUrl.trim() || null,
        liveUrl: values.liveUrl.trim() || null,
        repoUrl: values.repoUrl.trim() || null,
        playStoreUrl: values.playStoreUrl.trim() || null,
        appStoreUrl: values.appStoreUrl.trim() || null,
        featured: values.featured,
        challenges: values.challenges.trim() || null,
        solution: values.solution.trim() || null,
        outcome: values.outcome.trim() || null,
        testimonial: values.testimonial.trim() || null,
        testimonialAuthor: values.testimonialAuthor.trim() || null,
        tags,
        technologies,
      };

      return isEdit && project
        ? projectsApi.update(project.id, payload)
        : projectsApi.create(payload);
    },
    onSuccess: () => {
      onSuccess(isEdit ? 'Project updated' : 'Project added to your catalog', [
        queryKeys.projects.all,
        queryKeys.dashboard.overview,
      ]);
      onOpenChange(false);
    },
    onError: (error) => onError(error, 'Could not save the project'),
  });

  const addChip = (
    value: string,
    list: string[],
    setList: (next: string[]) => void,
    clear: () => void,
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    // Case-insensitive de-dupe so "React" and "react" don't both land.
    if (!list.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setList([...list, trimmed]);
    }
    clear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit project' : 'Add a project'}</DialogTitle>
          <DialogDescription>
            Catalog what you built, who it was for, and what it earned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <DialogBody>
            <Tabs defaultValue="basics">
              <TabsList>
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="commercial">Commercial</TabsTrigger>
                <TabsTrigger value="stack">Stack &amp; links</TabsTrigger>
                <TabsTrigger value="story">Case study</TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="space-y-4">
                <Field label="Project title" error={errors.title?.message} required>
                  <Input
                    placeholder="Nimbus Retail — Headless Commerce Platform"
                    error={Boolean(errors.title)}
                    {...register('title', { required: 'A title is required' })}
                  />
                </Field>

                <Field label="One-line summary" hint="Shown on the catalog card.">
                  <Input placeholder="A headless commerce platform serving 40k monthly shoppers." {...register('summary')} />
                </Field>

                <FieldRow>
                  <Field label="Client">
                    <Controller
                      control={control}
                      name="clientId"
                      render={({ field }) => (
                        <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Internal / no client" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Internal / no client</SelectItem>
                            {clients.data?.items.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.companyName ?? client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>

                  <Field label="Category" required>
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>{CATEGORY_LABELS[category]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </FieldRow>

                <FieldRow>
                  <Field label="Status">
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>

                  <Field label="Visibility" hint="Public projects can appear on an external portfolio.">
                    <Controller
                      control={control}
                      name="visibility"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VISIBILITIES.map((visibility) => (
                              <SelectItem key={visibility} value={visibility}>
                                {visibility.charAt(0) + visibility.slice(1).toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </FieldRow>

                <FieldRow>
                  <Field label="Start date">
                    <Input type="date" {...register('startDate')} />
                  </Field>
                  <Field label="End date">
                    <Input type="date" {...register('endDate')} />
                  </Field>
                </FieldRow>

                <Field label="Description" hint="The long-form story. Markdown-ish plain text is fine.">
                  <Textarea rows={5} placeholder="What the system does, how it is built, what it replaced…" {...register('description')} />
                </Field>

                <Controller
                  control={control}
                  name="featured"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-xs font-medium">Feature this project</p>
                        <p className="text-[11px] text-muted-foreground">Pinned to the top of your catalog.</p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </label>
                  )}
                />
              </TabsContent>

              <TabsContent value="commercial" className="space-y-4">
                <FormSection title="Commercials" description="Used for portfolio stats and invoice pre-fill.">
                  <FieldRow>
                    <Field label="Engagement model">
                      <Controller
                        control={control}
                        name="engagement"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ENGAGEMENTS.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="Currency">
                      <Controller
                        control={control}
                        name="currency"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'].map((code) => (
                                <SelectItem key={code} value={code}>{code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </FieldRow>

                  <FieldRow>
                    <Field label="Contract value">
                      <Input type="number" step="0.01" min="0" placeholder="850000" {...register('contractValue')} />
                    </Field>
                    <Field label="Hourly rate">
                      <Input type="number" step="0.01" min="0" placeholder="2500" {...register('hourlyRate')} />
                    </Field>
                  </FieldRow>

                  <Field label="Estimated hours">
                    <Input type="number" step="0.5" min="0" placeholder="320" {...register('estimatedHours')} />
                  </Field>
                </FormSection>
              </TabsContent>

              <TabsContent value="stack" className="space-y-5">
                <FormSection title="Technologies" description="Press Enter to add. These power the catalog filters.">
                  <div className="flex gap-2">
                    <Input
                      value={techDraft}
                      onChange={(event) => setTechDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addChip(techDraft, technologies, setTechnologies, () => setTechDraft(''));
                        }
                      }}
                      placeholder="Next.js, React Native, PostgreSQL…"
                      list="known-technologies"
                    />
                    <datalist id="known-technologies">
                      {knownTech.data?.map((tech) => <option key={tech.id} value={tech.name} />)}
                    </datalist>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addChip(techDraft, technologies, setTechnologies, () => setTechDraft(''))}
                    >
                      Add
                    </Button>
                  </div>

                  {technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {technologies.map((tech) => (
                        <Badge key={tech} variant="primary" className="gap-1 pr-1">
                          {tech}
                          <button
                            type="button"
                            onClick={() => setTechnologies(technologies.filter((item) => item !== tech))}
                            className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                            aria-label={`Remove ${tech}`}
                          >
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </FormSection>

                <FormSection title="Tags">
                  <div className="flex gap-2">
                    <Input
                      value={tagDraft}
                      onChange={(event) => setTagDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addChip(tagDraft, tags, setTags, () => setTagDraft(''));
                        }
                      }}
                      placeholder="ecommerce, fintech, performance…"
                    />
                    <Button type="button" variant="outline" onClick={() => addChip(tagDraft, tags, setTags, () => setTagDraft(''))}>
                      Add
                    </Button>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="gap-1 pr-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => setTags(tags.filter((item) => item !== tag))}
                            className="rounded-full p-0.5 transition-colors hover:bg-accent"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="size-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </FormSection>

                <FormSection title="Links">
                  <Field label="Cover image URL">
                    <Input placeholder="https://…" {...register('coverImageUrl')} />
                  </Field>
                  <FieldRow>
                    <Field label="Live site"><Input placeholder="https://…" {...register('liveUrl')} /></Field>
                    <Field label="Repository"><Input placeholder="https://github.com/…" {...register('repoUrl')} /></Field>
                  </FieldRow>
                  <FieldRow>
                    <Field label="Play Store"><Input placeholder="https://play.google.com/…" {...register('playStoreUrl')} /></Field>
                    <Field label="App Store"><Input placeholder="https://apps.apple.com/…" {...register('appStoreUrl')} /></Field>
                  </FieldRow>
                </FormSection>
              </TabsContent>

              <TabsContent value="story" className="space-y-4">
                <Field label="The challenge" hint="What problem were you hired to solve?">
                  <Textarea rows={3} {...register('challenges')} />
                </Field>
                <Field label="The solution" hint="What you actually built and why that approach.">
                  <Textarea rows={3} {...register('solution')} />
                </Field>
                <Field label="The outcome" hint="Numbers where you have them — they sell the next project.">
                  <Textarea rows={3} {...register('outcome')} />
                </Field>
                <Field label="Client testimonial">
                  <Textarea rows={2} {...register('testimonial')} />
                </Field>
                <Field label="Testimonial attribution">
                  <Input placeholder="Rohan Mehta, Founder — Nimbus Retail" {...register('testimonialAuthor')} />
                </Field>
              </TabsContent>
            </Tabs>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Add project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
