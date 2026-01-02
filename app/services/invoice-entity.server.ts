import { SupabaseClient } from "@supabase/supabase-js";
import invariant from "tiny-invariant";
import { siteConfig } from "~/config/site";
import type { Database } from "~/types/database.types";
import type {
  InvoiceEntity,
  InvoiceEntityWithStats,
  CreateInvoiceEntityData,
  InvoiceEntityFilters,
  EntityType,
} from "~/types/invoice";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { toCents, fromCents, addMoney, subtractMoney } from "~/utils/money";
import { convertRowToMoney, convertRowsToMoney, convertMoneyToRow, moneyFromRow } from "~/services/database-money.server";



/**
 * Create a new invoice entity
 */
export async function createInvoiceEntity(
  entityData: CreateInvoiceEntityData,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityData.name, "Missing entity name");
  invariant(entityData.entity_type, "Missing entity type");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log('[Service/createInvoiceEntity] Creating entity with data:', entityData);

  const { data: entity, error } = await client
    .from('invoice_entities')
    .insert({
      name: entityData.name,
      entity_type: entityData.entity_type,
      contact_person: entityData.contact_person,
      email: entityData.email || null,
      phone: entityData.phone,
      address_line1: entityData.address_line1,
      address_line2: entityData.address_line2,
      city: entityData.city,
      state: entityData.state,
      postal_code: entityData.postal_code,
      country: entityData.country || siteConfig.localization.country,
      tax_id: entityData.tax_id,
      payment_terms: entityData.payment_terms || 'Net 30',
      credit_limit: entityData.credit_limit ? toCents(entityData.credit_limit) : null,
      notes: entityData.notes,
    })
    .select()
    .single();

  if (error) {
    console.error('[Service/createInvoiceEntity] Error creating entity:', error);
    throw new Response(`Error creating invoice entity: ${error.message}`, { status: 500 });
  }

  return convertRowToMoney('invoice_entities', {
    ...entity,
    entity_type: entity.entity_type as EntityType,
  }) as unknown as InvoiceEntity;
}

/**
 * Get invoice entity by ID
 */
export async function getInvoiceEntityById(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity & { originalFamilyId?: string }> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/getInvoiceEntityById] Fetching entity details for ID: ${entityId}`);

  const { data: entity, error } = await client
    .from('invoice_entities')
    .select('*')
    .eq('id', entityId)
    .single();

  if (error) {
    console.error(`[Service/getInvoiceEntityById] Error fetching entity ${entityId}:`, error);
    throw new Response(`Database error: ${error.message}`, { status: 500 });
  }

  if (!entity) {
    throw new Response("Invoice entity not found", { status: 404 });
  }

  return convertRowToMoney('invoice_entities', {
    ...entity,
    entity_type: entity.entity_type as EntityType,
    originalFamilyId: entity.family_id || undefined,
  }) as unknown as (InvoiceEntity & { originalFamilyId?: string });
}

/**
 * Get invoice entities with filtering and pagination
 */
export async function getInvoiceEntities(
  filters: InvoiceEntityFilters = {},
  page: number = 1,
  limit: number = 20,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<{ entities: InvoiceEntity[]; total: number; totalPages: number }> {
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log('[Service/getInvoiceEntities] Fetching entities with filters:', filters);

  let query = client
    .from('invoice_entities')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.entity_type && filters.entity_type.length > 0) {
    query = query.in('entity_type', filters.entity_type);
  }
  
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }
  
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);
  
  // Order by name
  query = query.order('name', { ascending: true });

  const { data: entities, error, count } = await query;

  if (error) {
    console.error('[Service/getInvoiceEntities] Error fetching entities:', error);
    throw new Response(`Error fetching invoice entities: ${error.message}`, { status: 500 });
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    entities: (convertRowsToMoney('invoice_entities', entities || []) as unknown as InvoiceEntity[]) || [],
    total,
    totalPages,
  };
}

/**
 * Get invoice entities with statistics
 */
export async function getInvoiceEntitiesWithStats(
  filters: InvoiceEntityFilters = {},
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntityWithStats[]> {
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  // console.log('[Service/getInvoiceEntitiesWithStats] Fetching entities with stats');

  let entityQuery = client
    .from('invoice_entities')
    .select('*');

  // Apply filters
  if (filters.entity_type && filters.entity_type.length > 0) {
    entityQuery = entityQuery.in('entity_type', filters.entity_type);
  }
  
  if (filters.is_active !== undefined) {
    entityQuery = entityQuery.eq('is_active', filters.is_active);
  }
  
  if (filters.search) {
    entityQuery = entityQuery.or(`name.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  entityQuery = entityQuery.order('name', { ascending: true });

  const { data: entities, error: entitiesError } = await entityQuery;

  if (entitiesError) {
    console.error('[Service/getInvoiceEntitiesWithStats] Error fetching entities:', entitiesError);
    throw new Response(`Error fetching invoice entities: ${entitiesError.message}`, { status: 500 });
  }

  if (!entities || entities.length === 0) {
    return [];
  }

  // Get invoice statistics for each entity
  const entityIds = entities.map(entity => entity.id);
  
  const { data: invoiceStats, error: statsError } = await client
    .from('invoices')
    .select('entity_id, total_amount, total_amount_cents, amount_paid, amount_paid_cents, created_at')
    .in('entity_id', entityIds)
    .neq('status', 'cancelled');

  if (statsError) {
    console.error('[Service/getInvoiceEntitiesWithStats] Error fetching invoice stats:', statsError);
    // Continue without stats rather than failing
  }

  // Group stats by entity
  const statsByEntity = new Map<string, { total_invoices: number; total_amount: import('~/utils/money').Money; outstanding_amount: import('~/utils/money').Money; last_invoice_date: string | null }>();
  
  if (invoiceStats) {
    invoiceStats.forEach((invoice: unknown) => {
      const entityId = (invoice as { entity_id: string }).entity_id;
      if (!statsByEntity.has(entityId)) {
        statsByEntity.set(entityId, {
          total_invoices: 0,
          total_amount: fromCents(0),
          outstanding_amount: fromCents(0),
          last_invoice_date: null,
        });
      }
      const stats = statsByEntity.get(entityId)!;
      stats.total_invoices++;
      const total = moneyFromRow('invoices', 'total_amount', invoice as unknown as Record<string, unknown>);
      const paid = moneyFromRow('invoices', 'amount_paid', invoice as unknown as Record<string, unknown>);
      stats.total_amount = addMoney(stats.total_amount, total);
      stats.outstanding_amount = addMoney(stats.outstanding_amount, subtractMoney(total, paid));
      const createdAt = (invoice as Record<string, string | null | undefined>)['created_at'] || null;
      if (!stats.last_invoice_date || (createdAt && createdAt > stats.last_invoice_date)) {
        stats.last_invoice_date = createdAt;
      }
    });
  }

  // Combine entities with their stats
  const entitiesWithStats: InvoiceEntityWithStats[] = entities.map(entity => {
    const stats = statsByEntity.get(entity.id) || {
      total_invoices: 0,
      total_amount: 0,
      outstanding_amount: 0,
      last_invoice_date: null,
    };

    return {
      ...convertRowToMoney('invoice_entities', entity),
      entity_type: entity.entity_type as EntityType,
      total_invoices: stats.total_invoices,
      total_amount: stats.total_amount,
      outstanding_amount: stats.outstanding_amount,
      last_invoice_date: stats.last_invoice_date || undefined,
    } as unknown as InvoiceEntityWithStats;
  });

  return entitiesWithStats;
}

/**
 * Update invoice entity
 */
export async function updateInvoiceEntity(
  entityId: string,
  updateData: Partial<CreateInvoiceEntityData>,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/updateInvoiceEntity] Updating entity ${entityId} with data:`, updateData);

  const updateDataForDb = convertMoneyToRow('invoice_entities', {
    ...updateData,
    email: updateData.email || null, // Handle empty string as null
  }) || {};

  type EntityUpdate = Partial<Database['public']['Tables']['invoice_entities']['Update']>;
  const { data: entity, error } = await client
    .from('invoice_entities')
    .update(updateDataForDb as EntityUpdate)
    .eq('id', entityId)
    .select()
    .single();

  if (error) {
    console.error(`[Service/updateInvoiceEntity] Error updating entity:`, error);
    throw new Response(`Error updating invoice entity: ${error.message}`, { status: 500 });
  }

  if (!entity) {
    throw new Response("Invoice entity not found", { status: 404 });
  }

  return convertRowToMoney('invoice_entities', {
    ...entity,
    entity_type: entity.entity_type as EntityType,
  }) as unknown as InvoiceEntity;
}

/**
 * Delete invoice entity (hard delete - only allowed if no invoices exist)
 */
export async function deleteInvoiceEntity(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/deleteInvoiceEntity] Attempting to delete entity ${entityId}`);

  // Check if entity has any invoices (including cancelled ones)
  const { data: invoices, error: invoiceCheckError } = await client
    .from('invoices')
    .select('id')
    .eq('entity_id', entityId)
    .limit(1);

  if (invoiceCheckError) {
    console.error(`[Service/deleteInvoiceEntity] Error checking invoices:`, invoiceCheckError);
    throw new Response(`Error checking entity invoices: ${invoiceCheckError.message}`, { status: 500 });
  }

  if (invoices && invoices.length > 0) {
    throw new Response("Cannot delete entity with existing invoices. Use deactivate instead.", { status: 400 });
  }

  // Proceed with deletion
  const { error } = await client
    .from('invoice_entities')
    .delete()
    .eq('id', entityId);

  if (error) {
    console.error(`[Service/deleteInvoiceEntity] Error deleting entity:`, error);
    throw new Response(`Error deleting invoice entity: ${error.message}`, { status: 500 });
  }

  console.log(`[Service/deleteInvoiceEntity] Successfully deleted entity ${entityId}`);
}

/**
 * Deactivate invoice entity (soft delete)
 */
export async function deactivateInvoiceEntity(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/deactivateInvoiceEntity] Deactivating entity ${entityId}`);

  // Check if entity has active invoices
  const { data: activeInvoices } = await client
    .from('invoices')
    .select('id')
    .eq('entity_id', entityId)
    .in('status', ['draft', 'sent', 'viewed', 'partially_paid'])
    .limit(1);

  if (activeInvoices && activeInvoices.length > 0) {
    throw new Response("Cannot deactivate entity with active invoices", { status: 400 });
  }

  const { data: entity, error } = await client
    .from('invoice_entities')
    .update({ is_active: false })
    .eq('id', entityId)
    .select()
    .single();

  if (error) {
    console.error(`[Service/deactivateInvoiceEntity] Error deactivating entity:`, error);
    throw new Response(`Error deactivating invoice entity: ${error.message}`, { status: 500 });
  }

  if (!entity) {
    throw new Response("Invoice entity not found", { status: 404 });
  }

  return convertRowToMoney('invoice_entities', entity) as unknown as InvoiceEntity;
}

/**
 * Reactivate invoice entity
 */
export async function reactivateInvoiceEntity(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/reactivateInvoiceEntity] Reactivating entity ${entityId}`);

  const { data: entity, error } = await client
    .from('invoice_entities')
    .update({ is_active: true })
    .eq('id', entityId)
    .select()
    .single();

  if (error) {
    console.error(`[Service/reactivateInvoiceEntity] Error reactivating entity:`, error);
    throw new Response(`Error reactivating invoice entity: ${error.message}`, { status: 500 });
  }

  if (!entity) {
    throw new Response("Invoice entity not found", { status: 404 });
  }

  return convertRowToMoney('invoice_entities', entity) as unknown as InvoiceEntity;
}

/**
 * Get or create entity for a family
 */
export async function getOrCreateFamilyEntity(
  familyId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity & { originalFamilyId?: string }> {
  invariant(familyId, "Missing familyId parameter");
  
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/getOrCreateFamilyEntity] Getting or creating entity for family ${familyId}`);

  // First, try to find existing entity for this family
  const { data: existingEntity } = await client
    .from('invoice_entities')
    .select('*')
    .eq('entity_type', 'family')
    .eq('family_id', familyId)
    .single();

  if (existingEntity) {
    return {
      ...convertRowToMoney('invoice_entities', existingEntity),
      entity_type: existingEntity.entity_type as EntityType,
      originalFamilyId: existingEntity.family_id || familyId,
    } as unknown as (InvoiceEntity & { originalFamilyId: string });
  }

  // Get family details to create entity
  const { data: family, error: familyError } = await client
    .from('families')
    .select(`
      *,
      guardians(*)
    `)
    .eq('id', familyId)
    .single();

  if (familyError || !family) {
    console.error(`[Service/getOrCreateFamilyEntity] Error fetching family:`, familyError);
    throw new Response("Family not found", { status: 404 });
  }

  // Get primary guardian info
  const primaryGuardian = family.guardians?.[0];
  const contactName = primaryGuardian 
    ? `${primaryGuardian.first_name || ''} ${primaryGuardian.last_name || ''}`.trim()
    : 'Family Contact';

  // Create entity for family with family_id
  const { data: newEntity, error } = await client
    .from('invoice_entities')
    .insert({
      name: family.name,
      entity_type: 'family',
      family_id: familyId,
      contact_person: contactName,
      email: primaryGuardian?.email || null,
      phone: primaryGuardian?.cell_phone,
      country: siteConfig.localization.country,
      payment_terms: 'Net 30',
      notes: `Auto-created entity for family: ${family.name}`,
    })
    .select()
    .single();

  if (error) {
    console.error('[Service/getOrCreateFamilyEntity] Error creating entity:', error);
    throw new Response(`Error creating invoice entity: ${error.message}`, { status: 500 });
  }

  return convertRowToMoney('invoice_entities', {
    ...newEntity,
    entity_type: newEntity.entity_type as EntityType,
    originalFamilyId: familyId,
  }) as unknown as (InvoiceEntity & { originalFamilyId: string });
}

/**
 * Search entities for autocomplete
 */
export async function searchInvoiceEntities(
  searchTerm: string,
  limit: number = 10,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity[]> {
  const client = supabaseAdmin ?? getSupabaseAdminClient();
  
  console.log(`[Service/searchInvoiceEntities] Searching entities with term: ${searchTerm}`);

  const { data: entities, error } = await client
    .from('invoice_entities')
    .select('*')
    .eq('is_active', true)
    .or(`name.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Service/searchInvoiceEntities] Error searching entities:', error);
    throw new Response(`Error searching invoice entities: ${error.message}`, { status: 500 });
  }

  return (convertRowsToMoney('invoice_entities', entities || []) as unknown as InvoiceEntity[]) || [];
}
