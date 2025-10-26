/**
 * Shared utilities for incomplete event registrations
 * Safe to use on both client and server
 */

type RegistrationStep = 'student_selection' | 'waiver_signing' | 'payment';

interface IncompleteRegistration {
  id: string;
  event_id: string;
  current_step: RegistrationStep;
  selected_student_ids: string[];
}

/**
 * Get the resume URL for an incomplete registration based on current step
 */
export function getResumeUrl(incompleteReg: IncompleteRegistration): string {
  const { event_id, current_step, selected_student_ids } = incompleteReg;

  switch (current_step) {
    case 'student_selection':
      return `/events/${event_id}/register/students`;

    case 'waiver_signing':
      if (selected_student_ids.length > 0) {
        return `/events/${event_id}/register/waivers?studentIds=${selected_student_ids.join(',')}`;
      }
      return `/events/${event_id}/register/students`;

    case 'payment':
      if (selected_student_ids.length > 0) {
        return `/events/${event_id}/register?studentIds=${selected_student_ids.join(',')}`;
      }
      return `/events/${event_id}/register/students`;

    default:
      return `/events/${event_id}`;
  }
}

/**
 * Get human-readable step description
 */
export function getStepDescription(step: RegistrationStep): string {
  switch (step) {
    case 'student_selection':
      return 'Select students';
    case 'waiver_signing':
      return 'Sign waivers';
    case 'payment':
      return 'Complete payment';
    default:
      return 'Continue registration';
  }
}
