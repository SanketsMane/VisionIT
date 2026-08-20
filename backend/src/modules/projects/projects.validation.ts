import { EngagementModel, ProjectCategory, ProjectStatus, ProjectVisibility } from '@prisma/client';
import { z } from 'zod';

export const projectIdSchema = z.object({ id: z.string().min(1) });
export const projectSlugSchema = z.object({ slug: z.string().min(1) });

const optionalUrl = z.string().trim().url('Enter a valid URL').optional().nullable().or(z.literal(''));
const optionalDate = z.coerce.date().optional().nullable();

const projectFields = z.object({
  title: z.string().trim().min(3, 'Project title is required').max(180),
  /// Human-facing reference (ECH-2026-001). Generated when left blank.
  code: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only')
    .optional()
    .nullable(),
  logoUrl: z.string().trim().url('Enter a valid URL').optional().nullable().or(z.literal('')),
  clientId: z.string().min(1).optional().nullable(),
  summary: z.string().trim().max(400).optional().nullable(),
  description: z.string().trim().max(20000).optional().nullable(),
  category: z.nativeEnum(ProjectCategory).default(ProjectCategory.WEB_DEVELOPMENT),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.IN_PROGRESS),
  visibility: z.nativeEnum(ProjectVisibility).default(ProjectVisibility.PUBLIC),
  engagement: z.nativeEnum(EngagementModel).default(EngagementModel.FIXED_PRICE),

  startDate: optionalDate,
  endDate: optionalDate,
  deliveryDate: optionalDate,

  contractValue: z.coerce.number().nonnegative().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  estimatedHours: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),

  coverImageUrl: optionalUrl,
  galleryUrls: z.array(z.string().trim().url()).max(30).default([]),
  liveUrl: optionalUrl,
  repoUrl: optionalUrl,
  caseStudyUrl: optionalUrl,
  playStoreUrl: optionalUrl,
  appStoreUrl: optionalUrl,

  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  tags: z.array(z.string().trim().max(40)).max(25).default([]),
  technologies: z.array(z.string().trim().min(1).max(60)).max(40).default([]),

  challenges: z.string().trim().max(8000).optional().nullable(),
  solution: z.string().trim().max(8000).optional().nullable(),
  outcome: z.string().trim().max(8000).optional().nullable(),
  testimonial: z.string().trim().max(2000).optional().nullable(),
  testimonialAuthor: z.string().trim().max(150).optional().nullable(),
});

/**
 * Zod 4 refuses `.partial()` on a schema carrying refinements, so the plain
 * field shape above is the reusable base and the cross-field rule is attached
 * only to the create schema — updates validate each field independently.
 */
export const createProjectSchema = projectFields.refine(
  (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
  { message: 'End date cannot be before the start date', path: ['endDate'] },
);

export const updateProjectSchema = projectFields.partial().refine(
  (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
  { message: 'End date cannot be before the start date', path: ['endDate'] },
);

export const listProjectsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'startDate', 'endDate', 'sortOrder', 'contractValue']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
  category: z.nativeEnum(ProjectCategory).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional(),
  clientId: z.string().min(1).optional(),
  featured: z.coerce.boolean().optional(),
  tag: z.string().trim().max(40).optional(),
  technology: z.string().trim().max(60).optional(),
});

export const milestoneSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  dueDate: optionalDate,
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
  sortOrder: z.coerce.number().int().default(0),
});

export const logHoursSchema = z.object({
  hours: z.coerce.number().positive('Hours must be greater than zero').max(1000),
});

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int() })).min(1).max(200),
});

export type ProjectFieldsDto = z.infer<typeof projectFields>;
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type MilestoneDto = z.infer<typeof milestoneSchema>;
