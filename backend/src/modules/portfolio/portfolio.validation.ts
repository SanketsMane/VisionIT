import { z } from 'zod';

const CATEGORIES = [
  'WEB_DEVELOPMENT',
  'ANDROID_APP',
  'IOS_APP',
  'CROSS_PLATFORM_APP',
  'AI_ML',
  'DATA_ENGINEERING',
  'DEVOPS_CLOUD',
  'UI_UX_DESIGN',
  'BLOCKCHAIN',
  'DESKTOP_APP',
  'OTHER',
] as const;

/** Trims, then treats an empty string as "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const urlish = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || /^https?:\/\//i.test(value), 'Must start with http:// or https://')
  .optional()
  .transform((value) => (value ? value : undefined));

const stringList = (max: number, itemMax = 80) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max).optional();

export const createPortfolioSchema = z.object({
  title: z.string().trim().min(2, 'Give the work a title').max(140),
  slug: optionalText(80),
  tagline: z.string().trim().min(3, 'One line describing the work').max(200),
  summary: z.string().trim().min(10, 'Say a little more about it').max(8000),
  category: z.enum(CATEGORIES).default('WEB_DEVELOPMENT'),
  industry: optionalText(80),
  liveUrl: urlish,
  coverImage: optionalText(500),
  gallery: stringList(20, 500),
  techStack: stringList(30),
  highlights: stringList(12, 200),
  deliveredAt: z.coerce.date().optional(),
  clientLabel: optionalText(120),
  testimonial: optionalText(1200),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  sourceProjectId: optionalText(40),
});

/**
 * Every field optional, defined separately rather than with `.partial()`.
 * Zod 4 refuses `.partial()` on a schema carrying a `.refine()` — `liveUrl`
 * has one — and the failure only shows at boot.
 */
export const updatePortfolioSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  slug: optionalText(80),
  tagline: z.string().trim().min(3).max(200).optional(),
  summary: z.string().trim().min(10).max(8000).optional(),
  category: z.enum(CATEGORIES).optional(),
  industry: optionalText(80),
  liveUrl: urlish,
  coverImage: optionalText(500),
  gallery: stringList(20, 500),
  techStack: stringList(30),
  highlights: stringList(12, 200),
  deliveredAt: z.coerce.date().nullish(),
  clientLabel: optionalText(120),
  testimonial: optionalText(1200),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const listPortfolioSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  search: z.string().trim().max(120).optional(),
  /**
   * Written out rather than `z.coerce.boolean()`, which is `Boolean(value)` —
   * the string "false" is truthy, so `?published=false` would return the
   * published items.
   */
  published: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const publicCatalogSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
});

export const portfolioSlugSchema = z.object({
  slug: z.string().trim().min(1).max(80),
});

export const portfolioIdSchema = z.object({ id: z.string().min(1) });

export type CreatePortfolioDto = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioDto = z.infer<typeof updatePortfolioSchema>;
export type ListPortfolioDto = z.infer<typeof listPortfolioSchema>;
