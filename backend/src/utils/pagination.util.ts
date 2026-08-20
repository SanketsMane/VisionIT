export interface PaginationInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ResolvedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
  orderBy: Record<string, 'asc' | 'desc'>;
}

const MAX_LIMIT = 100;

/**
 * Normalises query pagination and clamps `limit` so a caller can't ask for
 * 100k rows. `sortBy` is validated against an allow-list per module rather
 * than passed straight into Prisma.
 */
export const resolvePagination = (
  input: PaginationInput,
  options: { defaultSortBy?: string; allowedSortFields?: string[]; defaultLimit?: number } = {},
): ResolvedPagination => {
  const { defaultSortBy = 'createdAt', allowedSortFields = [], defaultLimit = 20 } = options;

  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(input.limit) || defaultLimit)));

  const requested = input.sortBy?.trim();
  const sortBy =
    requested && (allowedSortFields.length === 0 || allowedSortFields.includes(requested))
      ? requested
      : defaultSortBy;
  const sortOrder: 'asc' | 'desc' = input.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  };
};
