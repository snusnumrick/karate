import type { Database } from "~/types/database.types";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import type { Money } from "~/utils/money";
import { moneyFromRow } from "~/utils/database-money";
import { getTodayLocalDateString } from "~/utils/misc";
import { isNetworkFetchError } from "~/utils/network-errors.server";

type EventRow = Database['public']['Tables']['events']['Row'];

type EventMoneyFields = {
  registration_fee: Money;
  late_registration_fee: Money;
};


// Type for upcoming events with selected fields and event type data
type UpcomingEventRow = Pick<EventRow,
  'id' |
  'title' |
  'description' |
  'event_type_id' |
  'status' |
  'start_date' |
  'end_date' |
  'start_time' |
  'end_time' |
  'location' |
  'address' |
  'registration_fee' |
  'registration_fee_cents' |
  'late_registration_fee' |
  'late_registration_fee_cents' |
  'registration_deadline' |
  'external_url' |
  'visibility' |
  'allow_self_participants'
>;

export type UpcomingEvent = Omit<UpcomingEventRow, 'registration_fee' | 'late_registration_fee'> & EventMoneyFields & {
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
type EventWithEventTypeRow = EventRow & {
  event_type: {
    name: string;
    display_name: string;
    color_class: string;
    border_class: string | null;
    dark_mode_class: string | null;
    icon: string | null;
  } | null;
};

export type EventWithEventType = Omit<EventWithEventTypeRow, 'registration_fee' | 'late_registration_fee'> & EventMoneyFields & {
  event_type: EventWithEventTypeRow['event_type'];
};

// Simple in-memory cache for events
const eventCache = new Map<string, { data: UpcomingEvent[], timestamp: number }>();
const loggedInEventCache = new Map<string, { data: UpcomingEvent[], timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

let supabase: ReturnType<typeof getSupabaseAdminClient> | null = null;

function getSupabase() {
  if (!supabase) {
    supabase = getSupabaseAdminClient();
  }
  return supabase;
}

function applyEventMoney<T extends Record<string, unknown>>(event: T): Omit<T, 'registration_fee' | 'late_registration_fee'> & EventMoneyFields {
  const record = event as Record<string, unknown>;
  return {
    ...event,
    registration_fee: moneyFromRow('events', 'registration_fee', record),
    late_registration_fee: moneyFromRow('events', 'late_registration_fee', record),
  } as Omit<T, 'registration_fee' | 'late_registration_fee'> & EventMoneyFields;
}

export class EventService {

  static async getUpcomingEvents(): Promise<UpcomingEvent[]> {
    const cacheKey = 'upcoming_events';
    const now = Date.now();

    // Check cache first
    const cached = eventCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    const today = getTodayLocalDateString();

    const { data: events, error } = await getSupabase()
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
        registration_fee_cents,
        late_registration_fee,
        late_registration_fee_cents,
        registration_deadline,
        external_url,
        visibility,
        allow_self_participants,
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
      .or(`end_date.gte.${today},end_date.is.null`)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(6);

    if (error) {
      if (isNetworkFetchError(error)) {
        console.warn('Unable to fetch upcoming events due to a temporary network issue.');
      } else {
        console.error('Error fetching upcoming events:', error);
      }
      return [];
    }

    const eventsData = (events || []).map(applyEventMoney);
    
    // Cache the results
    eventCache.set(cacheKey, { data: eventsData, timestamp: now });
    
    return eventsData;
  }

  static async getEventById(id: string, isLoggedIn: boolean = false): Promise<EventWithEventType | null> {
    let query = getSupabase()
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

    return applyEventMoney(event);
  }

  static async getEventsForLoggedInUsers(): Promise<UpcomingEvent[]> {
    const cacheKey = 'logged_in_events';
    const now = Date.now();

    const cached = loggedInEventCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    const today = getTodayLocalDateString();

    const { data: events, error } = await getSupabase()
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
        registration_fee_cents,
        late_registration_fee,
        late_registration_fee_cents,
        registration_deadline,
        external_url,
        visibility,
        allow_self_participants,
        event_type:event_types(
          name,
          display_name,
          color_class,
          border_class,
          dark_mode_class,
          icon
        )
      `)
      .in('visibility', ['public', 'limited', 'internal'])
      .in('status', ['published', 'registration_open'])
      .or(`end_date.gte.${today},end_date.is.null`)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(6);

    if (error) {
      console.error('Error fetching events for logged-in users:', error);
      return [];
    }

    const eventsData = (events || []).map(applyEventMoney);

    loggedInEventCache.set(cacheKey, { data: eventsData, timestamp: now });

    return eventsData;
  }

  static async canUserRegister(eventId: string, isLoggedIn: boolean): Promise<boolean> {
    const { data: event, error } = await getSupabase()
      .from('events')
      .select('visibility, allow_self_participants')
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

    if (event.allow_self_participants && isLoggedIn) {
      return true;
    }

    return true; // public and limited events allow registration for everyone
  }

  static async getAllUpcomingEvents(filters?: { allowSelfParticipants?: boolean }): Promise<UpcomingEvent[]> {
    const today = getTodayLocalDateString();
    let query = getSupabase()
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
        registration_fee_cents,
        late_registration_fee,
        late_registration_fee_cents,
        registration_deadline,
        external_url,
        visibility,
        allow_self_participants,
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
      .or(`end_date.gte.${today},end_date.is.null`)
      .gte('start_date', today);

    if (filters?.allowSelfParticipants !== undefined) {
      query = query.eq('allow_self_participants', filters.allowSelfParticipants);
    }

    const { data: events, error } = await query.order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching all upcoming events:', error);
      return [];
    }

    return (events || []).map(applyEventMoney);
  }

  static async getAllEventsForLoggedInUsers(): Promise<UpcomingEvent[]> {
    const today = getTodayLocalDateString();
    const { data: events, error } = await getSupabase()
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
        registration_fee_cents,
        late_registration_fee,
        late_registration_fee_cents,
        registration_deadline,
        external_url,
        visibility,
        allow_self_participants,
        event_type:event_types(
          name,
          display_name,
          color_class,
          border_class,
          dark_mode_class,
          icon
        )
      `)
      .in('visibility', ['public', 'limited', 'internal'])
      .in('status', ['published', 'registration_open'])
      .or(`end_date.gte.${today},end_date.is.null`)
      .gte('start_date', today)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching all events for logged-in users:', error);
      return [];
    }

    return (events || []).map(applyEventMoney);
  }

  static clearCache() {
    eventCache.clear();
    loggedInEventCache.clear();
  }

  static async registerAdultForEvent(
    eventId: string,
    profileId: string,
    options: {
      familyId?: string;
      studentId?: string;
      paymentAmountCents?: number;
      registrationStatus?: Database['public']['Enums']['registration_status_enum'];
    } = {}
  ) {
    let studentId = options.studentId;
    let familyId = options.familyId;

    if (!studentId || !familyId) {
      const { data: student, error: studentError } = await getSupabase()
        .from('students')
        .select('id, family_id')
        .eq('profile_id', profileId)
        .eq('is_adult', true)
        .single();

      if (studentError || !student) {
        throw new Error('Adult participant profile is missing a self-registrant student');
      }

      studentId = student.id;
      familyId = student.family_id;
    }

    const { data: existingByProfile } = await getSupabase()
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('participant_profile_id', profileId)
      .maybeSingle();

    if (existingByProfile) {
      throw new Error('Adult participant is already registered for this event');
    }

    const { data: existingByStudent } = await getSupabase()
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existingByStudent) {
      throw new Error('Student is already registered for this event');
    }

    const { data, error } = await getSupabase()
      .from('event_registrations')
      .insert({
        event_id: eventId,
        family_id: familyId,
        student_id: studentId,
        participant_profile_id: profileId,
        registration_status: options.registrationStatus ?? 'pending',
        payment_amount_cents: options.paymentAmountCents ?? 0,
      })
      .select('id, event_id, family_id, student_id, participant_profile_id, registration_status, payment_amount_cents, payment_required, payment_id')
      .single();

    if (error) {
      throw new Error(`Failed to register adult for event: ${error.message}`);
    }

    return data;
  }
}
