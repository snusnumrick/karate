import { getSupabaseAdminClient } from '~/utils/supabase.server';
import { createServerCache } from '~/utils/server-cache.server';

export type RequiredWaiver = {
  id: string;
  title: string;
};

const REQUIRED_WAIVERS_CACHE_KEY = 'required-waivers';
const REQUIRED_WAIVERS_CACHE_TTL_MS = 15 * 60 * 1000;

const requiredWaiversCache = createServerCache<string, RequiredWaiver[]>({
  defaultTtlMs: REQUIRED_WAIVERS_CACHE_TTL_MS,
});

export async function getRequiredWaivers(): Promise<RequiredWaiver[]> {
  return requiredWaiversCache.getOrLoad(REQUIRED_WAIVERS_CACHE_KEY, async () => {
    const { data, error } = await getSupabaseAdminClient()
      .from('waivers')
      .select('id, title')
      .eq('required', true);

    if (error) {
      throw new Error(`Failed to fetch required waivers: ${error.message}`);
    }

    return data ?? [];
  });
}

export function invalidateRequiredWaiversCache(): void {
  requiredWaiversCache.invalidate(REQUIRED_WAIVERS_CACHE_KEY);
}
