import type { Database } from "~/types/database.types";
import type { Event, CreateEventData, UpdateEventData } from "~/types/event";
import type { ExtendedSupabaseClient } from "~/types/supabase-extensions";
import { getSupabaseAdminClient } from "~/utils/supabase.server";

type Event = Database['public']['Tables']['events']['Row'];

// Type for upcoming events with selected fields
type UpcomingEvent = Pick<Event, 
    'id' | 'title' | 'description' | 'event_type_id' | 'status' | 
    'start_date' | 'end_date' | 'start_time' | 'end_time' | 
    'location' | 'registration_fee' | 'registration_deadline' | 'external_url'
>;

// Simple in-memory cache for events
const eventCache = new Map<string, { data: UpcomingEvent[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const supabase = getSupabaseAdminClient();

export class EventService {

  static async getUpcomingEvents(): Promise<UpcomingEvent[]> {
    const cacheKey = 'upcoming_events';
    const now = Date.now();
    
    // Check cache first
    const cached = eventCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }


    const today = new Date().toISOString().split('T')[0];

    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        description,
        event_type_id,
        status,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        registration_fee,
        registration_deadline,
        external_url
      `)
      .eq('is_public', true)
      .in('status', ['published', 'registration_open'])
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(6);

    if (error) {
      console.error('Error fetching upcoming events:', error);
      return [];
    }

    const eventsData = events || [];
    
    // Cache the results
    eventCache.set(cacheKey, { data: eventsData, timestamp: now });
    
    return eventsData;
  }

  static async getEventById(id: string): Promise<Event | null> {


    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('is_public', true)
      .single();

    if (error) {
      console.error('Error fetching event by ID:', error);
      return null;
    }

    return event;
  }

  static clearCache() {
    eventCache.clear();
  }
}