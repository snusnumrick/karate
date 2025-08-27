import type { Database } from "~/types/database.types";
import { getSupabaseAdminClient } from "~/utils/supabase.server";

type Event = Database['public']['Tables']['events']['Row'];

// Type for upcoming events with selected fields and event type data
export type UpcomingEvent = Pick<Event, 
    'id' | 'title' | 'description' | 'event_type_id' | 'status' | 
    'start_date' | 'end_date' | 'start_time' | 'end_time' | 
    'location' | 'address' | 'registration_fee' | 'registration_deadline' | 'external_url' | 'visibility'
> & {
    event_type: {
        name: string;
        display_name: string;
        color_class: string;
        border_class: string | null;
        dark_mode_class: string | null;
        icon: string | null;
    } | null;
};

// Type for event with event type data
export type EventWithEventType = Event & {
    event_type: {
        name: string;
        display_name: string;
        color_class: string;
        border_class: string | null;
        dark_mode_class: string | null;
        icon: string | null;
    } | null;
};

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
        address,
        registration_fee,
        registration_deadline,
        external_url,
        visibility,
        event_type:event_types(
          name,
          display_name,
          color_class,
          border_class,
          dark_mode_class,
          icon
        )
      `)
      .eq('visibility', 'public')
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

  static async getEventById(id: string, isLoggedIn: boolean = false): Promise<EventWithEventType | null> {
    let query = supabase
      .from('events')
      .select(`
        *,
        event_type:event_types(
          name,
          display_name,
          color_class,
          border_class,
          dark_mode_class,
          icon
        )
      `)
      .eq('id', id);

    // Apply visibility filter based on user authentication
    if (isLoggedIn) {
      // Logged-in users can see public, limited, and internal events
      query = query.in('visibility', ['public', 'limited', 'internal']);
    } else {
      // Non-logged-in users can only see public and limited events
      query = query.in('visibility', ['public', 'limited']);
    }

    const { data: event, error } = await query.single();

    if (error) {
      console.error('Error fetching event by ID:', error);
      // PGRST116 means no rows returned - event doesn't exist or doesn't match visibility criteria
      if (error.code === 'PGRST116') {
        console.log(`Event ${id} not found or not visible for user (isLoggedIn: ${isLoggedIn})`);
      }
      return null;
    }

    return event;
  }

  static async getEventsForLoggedInUsers(): Promise<UpcomingEvent[]> {
    const cacheKey = 'logged_in_events';
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
        address,
        registration_fee,
        registration_deadline,
        external_url,
        visibility,
        event_type:event_types(
          name,
          display_name,
          color_class,
          border_class,
          dark_mode_class,
          icon
        )
      `)
      .in('visibility', ['public', 'internal'])
      .in('status', ['published', 'registration_open'])
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(6);

    if (error) {
      console.error('Error fetching events for logged-in users:', error);
      return [];
    }

    const eventsData = events || [];
    
    // Cache the results
    eventCache.set(cacheKey, { data: eventsData, timestamp: now });
    
    return eventsData;
  }

  static async canUserRegister(eventId: string, isLoggedIn: boolean): Promise<boolean> {
    const { data: event, error } = await supabase
      .from('events')
      .select('visibility')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return false;
    }

    // Registration rules based on visibility:
    // - public: everyone can register
    // - limited: everyone can register (but not displayed on main page)
    // - internal: only logged-in users can register
    if (event.visibility === 'internal') {
      return isLoggedIn;
    }

    return true; // public and limited events allow registration for everyone
  }

  static clearCache() {
    eventCache.clear();
  }
}