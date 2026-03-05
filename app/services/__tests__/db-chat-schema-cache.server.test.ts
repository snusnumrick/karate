import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetDbChatSchemaCacheForTests,
  getCachedDbChatSchemaDescription,
  invalidateDbChatSchemaCache,
} from '../db-chat-schema-cache.server';

describe('db-chat-schema-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetDbChatSchemaCacheForTests();
  });

  it('returns cached schema on repeated reads', async () => {
    const loadSchema = vi.fn(async () => 'schema-v1');

    const first = await getCachedDbChatSchemaDescription(loadSchema);
    const second = await getCachedDbChatSchemaDescription(loadSchema);

    expect(first).toBe('schema-v1');
    expect(second).toBe('schema-v1');
    expect(loadSchema).toHaveBeenCalledTimes(1);
  });

  it('reloads schema after explicit invalidation', async () => {
    const loadSchema = vi
      .fn()
      .mockResolvedValueOnce('schema-v1')
      .mockResolvedValueOnce('schema-v2');

    await expect(getCachedDbChatSchemaDescription(loadSchema)).resolves.toBe('schema-v1');

    invalidateDbChatSchemaCache();

    await expect(getCachedDbChatSchemaDescription(loadSchema)).resolves.toBe('schema-v2');
    expect(loadSchema).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent schema refreshes', async () => {
    let resolveLoad: ((value: string) => void) | undefined;
    const loadSchema = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        })
    );

    const p1 = getCachedDbChatSchemaDescription(loadSchema);
    const p2 = getCachedDbChatSchemaDescription(loadSchema);

    await Promise.resolve();
    expect(loadSchema).toHaveBeenCalledTimes(1);

    resolveLoad?.('schema-v3');
    await expect(Promise.all([p1, p2])).resolves.toEqual(['schema-v3', 'schema-v3']);
  });
});
