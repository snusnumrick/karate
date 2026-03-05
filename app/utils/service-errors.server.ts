import { buildAppError, toErrorMessage } from '~/utils/errors';

export type ServiceErrorCode =
  | 'not_found'
  | 'validation_error'
  | 'authorization_error'
  | 'persistence_error'
  | 'service_error';

type ServiceErrorOptions = {
  code: ServiceErrorCode;
  message: string;
  status: number;
  details?: unknown;
  cause?: unknown;
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(options: ServiceErrorOptions) {
    super(options.message);
    this.name = 'ServiceError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function createNotFoundError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'not_found', message, details, status: 404 });
}

export function createValidationError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'validation_error', message, details, status: 400 });
}

export function createAuthorizationError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'authorization_error', message, details, status: 403 });
}

export function createPersistenceError(message: string, details?: unknown): ServiceError {
  return new ServiceError({ code: 'persistence_error', message, details, status: 500 });
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}

export function toServiceErrorResponseInit(error: unknown): {
  status: number;
  body: ReturnType<typeof buildAppError>;
} {
  if (isServiceError(error)) {
    return {
      status: error.status,
      body: buildAppError(error.code, error.message, error.details),
    };
  }

  return {
    status: 500,
    body: buildAppError('service_error', toErrorMessage(error, 'Internal server error')),
  };
}
