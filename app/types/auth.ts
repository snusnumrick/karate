import type { Database } from '~/types/database.types';

export type UserRole = Database['public']['Enums']['profile_role'];

export const USER_ROLE_VALUES = ['user', 'instructor', 'admin'] as const satisfies readonly UserRole[];

export function isAdminRole(role: UserRole | null | undefined): role is 'admin' {
  return role === 'admin';
}

export function isInstructorRole(role: UserRole | null | undefined): role is 'instructor' {
  return role === 'instructor';
}

export function isFamilyRole(role: UserRole | null | undefined): role is 'user' {
  return role === 'user';
}
