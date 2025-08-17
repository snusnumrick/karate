import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

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

export class EventService {
  private static getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    return createClient<Database>(supabaseUrl, supabaseServiceKey);
  }

  static async getUpcomingEvents(): Promise<UpcomingEvent[]> {
    const cacheKey = 'upcoming_events';
    const now = Date.now();
    
    // Check cache first
    const cached = eventCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    const supabase = this.getSupabaseClient();
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
    const supabase = this.getSupabaseClient();

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