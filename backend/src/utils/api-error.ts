import { StatusCodes } from 'http-status-codes';

export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * The only error type controllers/services should throw for expected failures.
 * `isOperational` separates "the client did something wrong" from genuine bugs,
 * which the error middleware uses to decide whether to leak details.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly issues?: FieldIssue[];
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    options: {
      code?: string;
      issues?: FieldIssue[];
      isOperational?: boolean;
      details?: unknown;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code ?? ApiError.defaultCode(statusCode);
    this.issues = options.issues;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace(this, this.constructor);
  }

  private static defaultCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'ERROR';
  }

  static badRequest(message = 'Bad request', issues?: FieldIssue[]): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, message, { issues });
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource'): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, `${resource} not found`, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Resource already exists'): ApiError {
    return new ApiError(StatusCodes.CONFLICT, message);
  }

  static unprocessable(message: string, issues?: FieldIssue[]): ApiError {
    return new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, message, { issues });
  }

  static tooManyRequests(message = 'Too many requests, please slow down'): ApiError {
    return new ApiError(StatusCodes.TOO_MANY_REQUESTS, message);
  }

  static internal(message = 'Something went wrong', cause?: unknown): ApiError {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message, {
      isOperational: false,
      cause,
    });
  }

  static serviceUnavailable(message = 'Service temporarily unavailable'): ApiError {
    return new ApiError(StatusCodes.SERVICE_UNAVAILABLE, message);
  }
}

export default ApiError;
