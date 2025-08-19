import { getSupabaseAdminClient } from "~/utils/supabase.server";
import type { TaxRate } from "~/types/invoice";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

/**
 * Get all active tax rates
 */
export async function getActiveTaxRates(
  supabaseClient?: SupabaseClient<Database>
): Promise<TaxRate[]> {
  const client = supabaseClient ?? getSupabaseAdminClient();
  
  const { data, error } = await client
    .from('tax_rates')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Service/getActiveTaxRates] Error fetching tax rates:', error);
    throw new Response(`Error fetching tax rates: ${error.message}`, { status: 500 });
  }

  return (data || []).map(item => ({
    ...item,
    description: item.description || undefined,
    region: item.region || undefined,
  }));
}

/**
 * Get tax rate by ID
 */
export async function getTaxRateById(
  id: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<TaxRate | null> {
  const client = supabaseClient ?? getSupabaseAdminClient();
  
  const { data, error } = await client
    .from('tax_rates')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error) {
    console.error('[Service/getTaxRateById] Error fetching tax rate:', error);
    return null;
  }

  return data ? {
    ...data,
    description: data.description || undefined,
    region: data.region || undefined,
  } : null;
}

/**
 * Get multiple tax rates by IDs
 */
export async function getTaxRatesByIds(
  ids: string[],
  supabaseClient?: SupabaseClient<Database>
): Promise<TaxRate[]> {
  if (ids.length === 0) return [];
  
  const client = supabaseClient ?? getSupabaseAdminClient();
  
  const { data, error } = await client
    .from('tax_rates')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Service/getTaxRatesByIds] Error fetching tax rates:', error);
    throw new Response(`Error fetching tax rates: ${error.message}`, { status: 500 });
  }

  return (data || []).map(item => ({
    ...item,
    description: item.description || undefined,
    region: item.region || undefined,
  }));
}