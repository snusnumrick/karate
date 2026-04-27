import { afterEach, describe, expect, it, vi } from 'vitest';
import { logStructuredError, toErrorMessage } from '~/utils/errors';

describe('toErrorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns message from Error instances', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns fallback for empty Error message', () => {
    expect(toErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });

  it('returns plain string values', () => {
    expect(toErrorMessage('  invalid request  ')).toBe('invalid request');
  });

  it('extracts message-like fields from objects', () => {
    expect(toErrorMessage({ message: 'server said no' })).toBe('server said no');
    expect(toErrorMessage({ error: 'bad payload' })).toBe('bad payload');
    expect(toErrorMessage({ statusText: 'Forbidden' })).toBe('Forbidden');
  });

  it('returns fallback for unknown object payloads', () => {
    expect(toErrorMessage({ foo: 'bar' }, 'safe fallback')).toBe('safe fallback');
  });

  it('never returns [object Object] for plain objects', () => {
    expect(toErrorMessage({ nested: { reason: 'x' } }, 'safe message')).toBe('safe message');
  });

  it('logs structured errors with a readable leading message', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logStructuredError('[PaymentReceiptPage ErrorBoundary] Caught error', {
      statusText: 'Not Found',
      data: { message: 'missing payment' },
    });

    expect(errorSpy).toHaveBeenCalledWith(
      '[PaymentReceiptPage ErrorBoundary] Caught error: Not Found',
      {
        error: {
          statusText: 'Not Found',
          data: { message: 'missing payment' },
        },
      }
    );
  });
});
