/**
 * Service for managing incomplete event registrations
 * Tracks registration flow state to allow users to resume interrupted registrations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database.types';

type RegistrationStep = 'student_selection' | 'waiver_signing' | 'payment';
type Json = Database['public']['Tables']['incomplete_event_registrations']['Row']['metadata'];

export interface IncompleteRegistration {
  id: string;
  family_id: string;
  event_id: string;
  current_step: RegistrationStep;
  selected_student_ids: string[];
  metadata: Json;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface IncompleteRegistrationWithEvent extends IncompleteRegistration {
  event: {
    id: string;
    title: string;
    start_date: string | null;
    registration_fee_cents: number;
  };
}

/**
 * Create or update an incomplete registration record
 */
export async function upsertIncompleteRegistration(
  supabase: SupabaseClient<Database>,
  data: {
    familyId: string;
    eventId: string;
    currentStep: RegistrationStep;
    selectedStudentIds?: string[];
    metadata?: Json;
  }
): Promise<{ data: IncompleteRegistration | null; error: Error | null }> {
  try {
    const { data: result, error } = await supabase
      .from('incomplete_event_registrations')
      .upsert(
        {
          family_id: data.familyId,
          event_id: data.eventId,
          current_step: data.currentStep,
          selected_student_ids: data.selectedStudentIds || [],
          metadata: data.metadata || null,
          dismissed_at: null, // Reset dismissed state when updating
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        },
        {
          onConflict: 'family_id,event_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[incomplete-registration] Error upserting incomplete registration:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: result as IncompleteRegistration, error: null };
  } catch (err) {
    console.error('[incomplete-registration] Unexpected error:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get all active incomplete registrations for a family
 */
export async function getIncompleteRegistrations(
  supabase: SupabaseClient<Database>,
  familyId: string
): Promise<{ data: IncompleteRegistrationWithEvent[] | null; error: Error | null }> {
  try {
    const { data: result, error } = await supabase
      .from('incomplete_event_registrations')
      .select(
        `
        *,
        events:event_id (
          id,
          title,
          start_date,
          registration_fee_cents
        )
      `
      )
      .eq('family_id', familyId)
      .is('dismissed_at', null) // Only get non-dismissed registrations
      .gt('expires_at', new Date().toISOString()) // Only get non-expired registrations
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[incomplete-registration] Error fetching incomplete registrations:', error);
      return { data: null, error: new Error(error.message) };
    }

    // Type assertion for the joined data
    const typedResult = (result || []).map((item) => ({
      ...item,
      event: Array.isArray(item.events) ? item.events[0] : item.events,
    })) as IncompleteRegistrationWithEvent[];

    return { data: typedResult, error: null };
  } catch (err) {
    console.error('[incomplete-registration] Unexpected error:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Mark an incomplete registration as dismissed
 */
export async function dismissIncompleteRegistration(
  supabase: SupabaseClient<Database>,
  incompleteRegistrationId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('incomplete_event_registrations')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', incompleteRegistrationId);

    if (error) {
      console.error('[incomplete-registration] Error dismissing incomplete registration:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('[incomplete-registration] Unexpected error:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Delete an incomplete registration (when registration is completed or cancelled)
 */
export async function deleteIncompleteRegistration(
  supabase: SupabaseClient<Database>,
  familyId: string,
  eventId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('incomplete_event_registrations')
      .delete()
      .eq('family_id', familyId)
      .eq('event_id', eventId);

    if (error) {
      console.error('[incomplete-registration] Error deleting incomplete registration:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('[incomplete-registration] Unexpected error:', err);
    return { success: false, error: err as Error };
  }
}

// Re-export helper functions from shared utils
export { getResumeUrl, getStepDescription } from '~/utils/incomplete-registration';
