import { getSupabaseServerClient } from '~/utils/supabase.server';
import type { Database } from '~/types/database.types';

export type EventType = Database['public']['Tables']['event_types']['Row'];
export type EventTypeInsert = Database['public']['Tables']['event_types']['Insert'];
export type EventTypeUpdate = Database['public']['Tables']['event_types']['Update'];

export class EventTypeService {
  private supabase;

  constructor(request: Request) {
    const { supabaseServer } = getSupabaseServerClient(request);
    this.supabase = supabaseServer;
  }

  /**
   * Get all active event types ordered by sort_order
   */
  async getActiveEventTypes(): Promise<EventType[]> {
    const { data, error } = await this.supabase
      .from('event_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch event types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all event types (including inactive)
   */
  async getAllEventTypes(): Promise<EventType[]> {
    const { data, error } = await this.supabase
      .from('event_types')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch all event types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get event type by name
   */
  async getEventTypeByName(name: string): Promise<EventType | null> {
    const { data, error } = await this.supabase
      .from('event_types')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch event type: ${error.message}`);
    }

    return data;
  }

  /**
   * Get event type by ID
   */
  async getEventTypeById(id: string): Promise<EventType | null> {
    const { data, error } = await this.supabase
      .from('event_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch event type: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new event type
   */
  async createEventType(eventTypeData: EventTypeInsert): Promise<EventType> {
    const { data, error } = await this.supabase
      .from('event_types')
      .insert(eventTypeData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create event type: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing event type
   */
  async updateEventType(id: string, updateData: EventTypeUpdate): Promise<EventType> {
    const { data, error } = await this.supabase
      .from('event_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update event type: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete an event type (set is_active to false)
   */
  async deactivateEventType(id: string): Promise<EventType> {
    const { data, error } = await this.supabase
      .from('event_types')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deactivate event type: ${error.message}`);
    }

    return data;
  }

  /**
   * Reactivate an event type
   */
  async activateEventType(id: string): Promise<EventType> {
    const { data, error } = await this.supabase
      .from('event_types')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to activate event type: ${error.message}`);
    }

    return data;
  }

  /**
   * Hard delete an event type (permanent deletion)
   * Use with caution - this will fail if there are events using this type
   */
  async deleteEventType(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('event_types')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete event type: ${error.message}`);
    }
  }

  /**
   * Update sort order for multiple event types
   */
  async updateSortOrder(updates: { id: string; sort_order: number }[]): Promise<void> {
    const promises = updates.map(({ id, sort_order }) =>
      this.supabase
        .from('event_types')
        .update({ sort_order })
        .eq('id', id)
    );

    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.error) {
        throw new Error(`Failed to update sort order: ${result.error.message}`);
      }
    }
  }
}