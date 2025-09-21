import { getSupabaseAdminClient } from "~/utils/supabase.server";
import type { TaxRate, InvoiceItemType } from "~/types/invoice";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import {addMoney, Money, multiplyMoney, ZERO_MONEY} from "~/utils/money";

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
 * Get applicable tax rates for a specific item type, applying BC PST exemption rules
 * British Columbia does not charge PST for memberships, including event registrations and one-off sessions
 * Also supports age-based exemptions (e.g., students under 15)
 */
export async function getApplicableTaxRates(
  itemType: InvoiceItemType,
  supabaseClient?: SupabaseClient<Database>,
  options?: { exemptFromPST?: boolean }
): Promise<TaxRate[]> {
  const allTaxRates = await getActiveTaxRates(supabaseClient);
  
  // BC PST exemption: memberships (class_enrollment) and event registrations (individual_session) are exempt from PST_BC
  const exemptItemTypes: InvoiceItemType[] = ['class_enrollment', 'individual_session'];
  
  // Check if PST exemption applies either by item type or explicit option
  const isPSTExempt = exemptItemTypes.includes(itemType) || options?.exemptFromPST;
  
  if (isPSTExempt) {
    // Filter out PST_BC for exempt items
    return allTaxRates.filter(rate => rate.name !== 'PST_BC');
  }
  
  // For all other item types, return all active tax rates
  return allTaxRates;
}

/**
 * Get applicable tax rates for store purchases, automatically handling age-based PST exemptions
 * This is a convenience function that encapsulates the age check logic
 */
export async function getApplicableTaxRatesForStorePurchase(
  studentId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<TaxRate[]> {
  const client = supabaseClient ?? getSupabaseAdminClient();
  
  // Check if student is under 15 for PST exemption
  const isStudentUnder15 = await hasStudentsUnder15([studentId], client);
  
  return getApplicableTaxRates('product', client, { exemptFromPST: isStudentUnder15 });
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

/**
 * Check if any of the provided students are under 15 years old
 * Used for BC PST exemption on store purchases for students under 15
 */
async function hasStudentsUnder15(
  studentIds: string[],
  supabaseClient?: SupabaseClient<Database>
): Promise<boolean> {
  if (!studentIds || studentIds.length === 0) {
    return false;
  }

  const client = supabaseClient ?? getSupabaseAdminClient();
  const { data: students, error } = await client
    .from('students')
    .select('birth_date')
    .in('id', studentIds);

  if (error || !students) {
    console.error('[Service/hasStudentsUnder15] Error fetching student birth dates:', error?.message);
    return false; // If we can't determine age, don't apply exemption
  }

  const today = new Date();
  
  for (const student of students) {
    if (student.birth_date) {
      const birthDate = new Date(student.birth_date);
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      let actualAge = age;
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        actualAge = age - 1;
      }
      
      if (actualAge < 15) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate applicable tax rates and amounts for a payment
 * Handles BC PST exemptions based on payment type and student age
 */
export async function calculateTaxesForPayment({
  subtotalAmount,
  paymentType,
  studentIds,
  supabaseClient
}: {
  subtotalAmount: Money;
  paymentType: string;
  studentIds?: string[];
  supabaseClient?: SupabaseClient<Database>;
}): Promise<{
  totalTaxAmount: Money;
  paymentTaxes: Array<{
    tax_rate_id: string;
    tax_amount: Money;
    tax_rate_snapshot: number;
    tax_name_snapshot: string;
  }>;
  error?: string;
}> {
  const client = supabaseClient ?? getSupabaseAdminClient();
  
  // Map payment types to invoice item types
  let itemType: InvoiceItemType;
  let exemptFromPST = false;
  
  if (paymentType === 'monthly_group' || paymentType === 'yearly_group') {
    itemType = 'class_enrollment';
  } else if (paymentType === 'individual_session') {
    itemType = 'individual_session';
  } else if (paymentType === 'event_registration') {
    // Event registrations are exempt from BC PST like individual sessions
    itemType = 'individual_session';
  } else {
    // For store_purchase and other types
    itemType = 'product';
    
    // Special case: store purchase with students under 15 gets PST exemption
    if (paymentType === 'store_purchase' && studentIds && studentIds.length > 0) {
      const hasUnder15 = await hasStudentsUnder15(studentIds, client);
      if (hasUnder15) {
        exemptFromPST = true;
        console.log('[Service/calculateTaxesForPayment] PST_BC exemption applied for store purchase - student(s) under 15 years old');
      }
    }
  }
  
  // Get applicable tax rates using the centralized exemption logic
  const taxRatesData = await getApplicableTaxRates(itemType, client, { exemptFromPST });
  
  if (taxRatesData.length === 0) {
    console.warn(`[Service/calculateTaxesForPayment] No active tax rates found for item type: ${itemType}. Proceeding without tax.`);
    return { totalTaxAmount: ZERO_MONEY, paymentTaxes: [] };
  }

  // Calculate individual taxes and total tax on the subtotal
  let totalTaxAmount : Money = ZERO_MONEY;
  const paymentTaxes: Array<{
    tax_rate_id: string;
    tax_amount: Money;
    tax_rate_snapshot: number;
    tax_name_snapshot: string;
  }> = [];

  for (const taxRate of taxRatesData) {
    // TaxRate objects already have the correct structure from getActiveTaxRates
    const rate = taxRate.rate;
    if (isNaN(rate)) {
      console.error(`[Service/calculateTaxesForPayment] Invalid tax rate found for ${taxRate.name}: ${rate}`);
      continue; // Skip this tax rate
    }
    
    // Calculate tax on the subtotal
    const taxAmountForThisRate : Money = multiplyMoney(subtotalAmount, rate);
    totalTaxAmount = addMoney(totalTaxAmount, taxAmountForThisRate);
    paymentTaxes.push({
      tax_rate_id: taxRate.id,
      tax_amount: taxAmountForThisRate,
      tax_rate_snapshot: rate, // Store the rate used
      tax_name_snapshot: taxRate.name, // Store the name used
    });
  }

  return { totalTaxAmount, paymentTaxes };
}