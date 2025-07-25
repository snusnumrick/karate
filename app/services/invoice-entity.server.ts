import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

// Helper to create admin client
function createSupabaseAdminClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Service/createSupabaseAdminClient] Missing Supabase URL or Service Role Key env vars.");
    throw new Response("Server configuration error: Missing Supabase credentials.", { status: 500 });
  }
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

/**
 * Create a new invoice entity
 */
export async function createInvoiceEntity(
  entityData: CreateInvoiceEntityData,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityData.name, "Missing entity name");
  invariant(entityData.entity_type, "Missing entity type");
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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
      credit_limit: entityData.credit_limit,
      notes: entityData.notes,
    })
    .select()
    .single();

  if (error) {
    console.error('[Service/createInvoiceEntity] Error creating entity:', error);
    throw new Response(`Error creating invoice entity: ${error.message}`, { status: 500 });
  }

  return {
    ...entity,
    entity_type: entity.entity_type as EntityType,
  } as InvoiceEntity;
}

/**
 * Get invoice entity by ID
 */
export async function getInvoiceEntityById(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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

  return {
    ...entity,
    entity_type: entity.entity_type as EntityType,
  } as InvoiceEntity;
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
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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
    entities: (entities || []) as InvoiceEntity[],
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
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
  console.log('[Service/getInvoiceEntitiesWithStats] Fetching entities with stats');

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
    .select('entity_id, total_amount, amount_paid, created_at')
    .in('entity_id', entityIds)
    .neq('status', 'cancelled');

  if (statsError) {
    console.error('[Service/getInvoiceEntitiesWithStats] Error fetching invoice stats:', statsError);
    // Continue without stats rather than failing
  }

  // Group stats by entity
  const statsByEntity = new Map();
  
  if (invoiceStats) {
    invoiceStats.forEach(invoice => {
      if (!statsByEntity.has(invoice.entity_id)) {
        statsByEntity.set(invoice.entity_id, {
          total_invoices: 0,
          total_amount: 0,
          outstanding_amount: 0,
          last_invoice_date: null,
        });
      }
      
      const stats = statsByEntity.get(invoice.entity_id);
      stats.total_invoices++;
      stats.total_amount += invoice.total_amount;
      stats.outstanding_amount += (invoice.total_amount - invoice.amount_paid);
      
      if (!stats.last_invoice_date || (invoice.created_at && invoice.created_at > stats.last_invoice_date)) {
        stats.last_invoice_date = invoice.created_at;
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
      ...entity,
      entity_type: entity.entity_type as EntityType,
      total_invoices: stats.total_invoices,
      total_amount: Math.round(stats.total_amount * 100) / 100,
      outstanding_amount: Math.round(stats.outstanding_amount * 100) / 100,
      last_invoice_date: stats.last_invoice_date,
    } as InvoiceEntityWithStats;
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
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
  console.log(`[Service/updateInvoiceEntity] Updating entity ${entityId} with data:`, updateData);

  const { data: entity, error } = await client
    .from('invoice_entities')
    .update({
      ...updateData,
      email: updateData.email || null, // Handle empty string as null
    })
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

  return {
    ...entity,
    entity_type: entity.entity_type as EntityType,
  } as InvoiceEntity;
}

/**
 * Delete invoice entity (hard delete - only allowed if no invoices exist)
 */
export async function deleteInvoiceEntity(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<void> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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

  return entity as InvoiceEntity;
}

/**
 * Reactivate invoice entity
 */
export async function reactivateInvoiceEntity(
  entityId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(entityId, "Missing entityId parameter");
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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

  return entity as InvoiceEntity;
}

/**
 * Get or create entity for a family
 */
export async function getOrCreateFamilyEntity(
  familyId: string,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity> {
  invariant(familyId, "Missing familyId parameter");
  
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
  console.log(`[Service/getOrCreateFamilyEntity] Getting or creating entity for family ${familyId}`);

  // First, try to find existing entity for this family
  const { data: existingInvoices } = await client
    .from('invoices')
    .select('entity_id, invoice_entities(*)')
    .eq('family_id', familyId)
    .limit(1);

  if (existingInvoices && existingInvoices.length > 0) {
    const entity = existingInvoices[0].invoice_entities;
    if (entity) {
      return {
        ...entity,
        entity_type: entity.entity_type as EntityType,
      } as InvoiceEntity;
    }
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

  // Create entity for family
  const entityData: CreateInvoiceEntityData = {
    name: family.name,
    entity_type: 'family',
    contact_person: contactName,
    email: primaryGuardian?.email,
    phone: primaryGuardian?.cell_phone,
    payment_terms: 'Net 30',
    notes: `Auto-created entity for family: ${family.name}`,
  };

  return createInvoiceEntity(entityData, client);
}

/**
 * Search entities for autocomplete
 */
export async function searchInvoiceEntities(
  searchTerm: string,
  limit: number = 10,
  supabaseAdmin?: SupabaseClient<Database>
): Promise<InvoiceEntity[]> {
  const client = supabaseAdmin ?? createSupabaseAdminClient();
  
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

  return (entities || []) as InvoiceEntity[];
}