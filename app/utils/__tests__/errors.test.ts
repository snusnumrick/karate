import { describe, expect, it } from 'vitest';
import { toErrorMessage } from '~/utils/errors';

describe('toErrorMessage', () => {
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
});
