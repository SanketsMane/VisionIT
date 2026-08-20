import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { ApiError, type FieldIssue } from '@utils/api-error';

interface ErrorBody {
  success: false;
  message: string;
  code: string;
  issues?: FieldIssue[];
  stack?: string;
  requestId?: string;
  timestamp: string;
}

/** Maps driver/ORM/library errors onto the API's own ApiError vocabulary. */
const normalize = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return ApiError.unprocessable(
      'Validation failed',
      error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target.join(', ') : String(target);
        return ApiError.conflict(
          fields ? `A record with this ${fields} already exists` : 'Duplicate record',
        );
      }
      case 'P2025':
        return ApiError.notFound('Record');
      case 'P2003':
        return ApiError.badRequest(
          'This record is linked to other data and cannot be modified or removed',
        );
      case 'P2014':
        return ApiError.badRequest('The change would violate a required relation');
      default:
        return new ApiError(StatusCodes.BAD_REQUEST, 'Database request failed', {
          code: `PRISMA_${error.code}`,
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ApiError(StatusCodes.BAD_REQUEST, 'Malformed database query', {
      code: 'PRISMA_VALIDATION',
      isOperational: false,
    });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return ApiError.serviceUnavailable('Cannot reach the database right now');
  }

  if (error instanceof MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File is larger than the ${env.MAX_UPLOAD_SIZE_MB}MB limit`
        : `Upload failed: ${error.message}`;
    return ApiError.badRequest(message);
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return ApiError.badRequest('Request body is not valid JSON');
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  return ApiError.internal(message, error);
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const apiError = normalize(error);

  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status: apiError.statusCode,
    userId: req.user?.id,
  };

  if (!apiError.isOperational || apiError.statusCode >= 500) {
    // `cause` holds the original throw site; without it the log would only
    // show this middleware's own frames, which say nothing useful.
    const cause = apiError.cause;
    logger.error(apiError.message, {
      ...logPayload,
      stack: cause instanceof Error ? cause.stack : apiError.stack,
    });
  } else {
    logger.warn(apiError.message, logPayload);
  }

  // Never surface internals of a non-operational failure to the client.
  const clientMessage =
    !apiError.isOperational && env.isProduction ? 'Something went wrong' : apiError.message;

  const body: ErrorBody = {
    success: false,
    message: clientMessage,
    code: apiError.code,
    timestamp: new Date().toISOString(),
  };

  if (apiError.issues?.length) body.issues = apiError.issues;
  if (req.requestId) body.requestId = req.requestId;
  if (!env.isProduction && apiError.stack) body.stack = apiError.stack;

  res.status(apiError.statusCode).json(body);
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(StatusCodes.NOT_FOUND, `Route ${req.method} ${req.originalUrl} not found`, {
    code: 'ROUTE_NOT_FOUND',
  }));
};
