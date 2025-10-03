import type { Program } from '~/types/multi-class';

export interface ClassValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Subset of Program fields needed for validation (doesn't include Money fields)
export type ProgramForValidation = Pick<Program,
  'max_capacity' | 'sessions_per_week' | 'min_sessions_per_week' | 'max_sessions_per_week' |
  'min_age' | 'max_age' | 'duration_minutes' | 'name'
>;

export interface ClassValidationData {
  maxCapacity?: number;
  schedules: Array<{ day_of_week: string; start_time: string }>;
  program: ProgramForValidation;
}

/**
 * Validate class data against program constraints
 */
export function validateClassConstraints(data: ClassValidationData): ClassValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate max capacity constraint
  if (data.maxCapacity && data.program.max_capacity) {
    if (data.maxCapacity > data.program.max_capacity) {
      errors.push(
        `Class capacity (${data.maxCapacity}) cannot exceed program's maximum capacity (${data.program.max_capacity})`
      );
    }
  }

  // Validate session frequency constraints
  const scheduledSessionsPerWeek = data.schedules.filter(
    schedule => schedule.day_of_week && schedule.start_time
  ).length;

  if (scheduledSessionsPerWeek > 0) {
    // Check exact sessions per week requirement
    if (data.program.sessions_per_week) {
      if (scheduledSessionsPerWeek !== data.program.sessions_per_week) {
        errors.push(
          `This program requires exactly ${data.program.sessions_per_week} session${data.program.sessions_per_week > 1 ? 's' : ''} per week, but ${scheduledSessionsPerWeek} session${scheduledSessionsPerWeek > 1 ? 's are' : ' is'} scheduled`
        );
      }
    }
    // Check min/max sessions per week range
    else if (data.program.min_sessions_per_week || data.program.max_sessions_per_week) {
      const minSessions = data.program.min_sessions_per_week || 1;
      const maxSessions = data.program.max_sessions_per_week || 7;

      if (scheduledSessionsPerWeek < minSessions) {
        errors.push(
          `This program requires at least ${minSessions} session${minSessions > 1 ? 's' : ''} per week, but only ${scheduledSessionsPerWeek} session${scheduledSessionsPerWeek > 1 ? 's are' : ' is'} scheduled`
        );
      }

      if (scheduledSessionsPerWeek > maxSessions) {
        errors.push(
          `This program allows at most ${maxSessions} session${maxSessions > 1 ? 's' : ''} per week, but ${scheduledSessionsPerWeek} session${scheduledSessionsPerWeek > 1 ? 's are' : ' is'} scheduled`
        );
      }
    }
  }

  // Add errors for missing schedules when program has session requirements
  if (scheduledSessionsPerWeek === 0) {
    if (data.program.sessions_per_week) {
      errors.push(
        `This class must have exactly ${data.program.sessions_per_week} session${data.program.sessions_per_week > 1 ? 's' : ''} per week. Please add a schedule.`
      );
    } else if (data.program.min_sessions_per_week) {
      errors.push(
        `This class must have at least ${data.program.min_sessions_per_week} session${data.program.min_sessions_per_week > 1 ? 's' : ''} per week. Please add a schedule.`
      );
    } else {
      // No specific program requirements, but at least one session is required
      errors.push(
        "This class must have at least 1 session per week. Please add a schedule."
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get default max capacity for a class based on program constraints
 */
export function getDefaultMaxCapacity(program: ProgramForValidation): number | undefined {
  return program.max_capacity;
}

/**
 * Get session frequency description for a program
 */
export function getSessionFrequencyDescription(program: ProgramForValidation): string {
  if (program.sessions_per_week) {
    return `This program requires exactly ${program.sessions_per_week} session${program.sessions_per_week > 1 ? 's' : ''} per week.`;
  }
  
  if (program.min_sessions_per_week && program.max_sessions_per_week) {
    return `This program requires ${program.min_sessions_per_week}-${program.max_sessions_per_week} sessions per week.`;
  }
  
  if (program.min_sessions_per_week) {
    return `This program requires at least ${program.min_sessions_per_week} session${program.min_sessions_per_week > 1 ? 's' : ''} per week.`;
  }
  
  if (program.max_sessions_per_week) {
    return `This program allows up to ${program.max_sessions_per_week} session${program.max_sessions_per_week > 1 ? 's' : ''} per week.`;
  }
  
  return "This program requires at least 1 session per week.";
}