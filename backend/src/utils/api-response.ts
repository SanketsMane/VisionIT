import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
  timestamp: string;
}

/**
 * Every 2xx response in the API shares this envelope so the frontend can have
 * exactly one unwrap path (`res.data.data`) and one error path.
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode: number = StatusCodes.OK,
  meta?: PaginationMeta | Record<string, unknown>,
): Response<SuccessEnvelope<T>> =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  });

export const sendCreated = <T>(res: Response, data: T, message = 'Created successfully') =>
  sendSuccess(res, data, message, StatusCodes.CREATED);

export const sendNoContent = (res: Response) => res.status(StatusCodes.NO_CONTENT).send();

export const sendPaginated = <T>(
  res: Response,
  items: T[],
  { page, limit, total }: { page: number; limit: number; total: number },
  message = 'Fetched successfully',
) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return sendSuccess(res, items, message, StatusCodes.OK, {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  });
};

export const buildPaginationMeta = (
  page: number,
  limit: number,
  total: number,
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
