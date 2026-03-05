import { createServerCache } from '~/utils/server-cache.server';

const SCHEMA_CACHE_KEY = 'db-chat-schema-description';
const SCHEMA_CACHE_TTL_MS = 60 * 60 * 1000;

const dbChatSchemaCache = createServerCache<string, string>({
  defaultTtlMs: SCHEMA_CACHE_TTL_MS,
});

export async function getCachedDbChatSchemaDescription(
  loadSchemaDescription: () => Promise<string>
): Promise<string> {
  return dbChatSchemaCache.getOrLoad(SCHEMA_CACHE_KEY, loadSchemaDescription);
}

export function invalidateDbChatSchemaCache(): void {
  dbChatSchemaCache.invalidate(SCHEMA_CACHE_KEY);
}

export function __resetDbChatSchemaCacheForTests(): void {
  dbChatSchemaCache.invalidate();
}
