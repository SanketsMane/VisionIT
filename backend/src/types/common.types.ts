import type { Request } from 'express';

/**
 * A request that has passed through `authenticate` — `user` is guaranteed.
 *
 * Express 5 types `req.params` values as `string | string[]` to model repeated
 * route segments. Every route here uses single-value params validated by zod,
 * so `P` is narrowed to plain strings and controllers can use them directly.
 */
export interface AuthedRequest<
  P extends Record<string, string> = Record<string, string>,
  B = unknown,
  Q = unknown,
> extends Request<P, unknown, B, Q> {
  user: Express.AuthenticatedUser;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

export type Nullable<T> = T | null;

/** Recursively converts Prisma `Decimal` fields to `number` for JSON output. */
export type Serialized<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: Serialized<T[K]> }
    : T;
