import { describe, expect, it } from 'vitest';
import {
  ServiceError,
  createAuthorizationError,
  createNotFoundError,
  createPersistenceError,
  createValidationError,
  isServiceError,
  toServiceErrorResponseInit,
} from '../service-errors.server';

describe('ServiceError helpers', () => {
  it('creates typed ServiceError instances with expected code/status', () => {
    const notFound = createNotFoundError('Missing resource');
    const validation = createValidationError('Bad input');
    const authorization = createAuthorizationError('Forbidden');
    const persistence = createPersistenceError('DB failed');

    expect(notFound).toBeInstanceOf(ServiceError);
    expect(notFound.code).toBe('not_found');
    expect(notFound.status).toBe(404);

    expect(validation.code).toBe('validation_error');
    expect(validation.status).toBe(400);

    expect(authorization.code).toBe('authorization_error');
    expect(authorization.status).toBe(403);

    expect(persistence.code).toBe('persistence_error');
    expect(persistence.status).toBe(500);
  });

  it('recognizes ServiceError via type guard', () => {
    expect(isServiceError(createValidationError('Invalid payload'))).toBe(true);
    expect(isServiceError(new Error('plain error'))).toBe(false);
    expect(isServiceError('boom')).toBe(false);
  });

  it('maps ServiceError to HTTP response init preserving status and details', () => {
    const error = createValidationError('Validation failed', { field: 'email' });
    const mapped = toServiceErrorResponseInit(error);

    expect(mapped.status).toBe(400);
    expect(mapped.body).toEqual({
      code: 'validation_error',
      message: 'Validation failed',
      details: { field: 'email' },
    });
  });

  it('maps unknown errors to 500 service_error envelope', () => {
    const mapped = toServiceErrorResponseInit(new Error('unexpected failure'));

    expect(mapped.status).toBe(500);
    expect(mapped.body).toEqual({
      code: 'service_error',
      message: 'unexpected failure',
    });
  });
});
