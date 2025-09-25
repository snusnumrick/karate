// NOTE: These defaults exist solely as a last-resort fallback when
// Supabase data is unavailable (SSR errors, hydration without cache, etc.).
// All feature logic should prefer program/class-derived values instead.
export const DEFAULT_SCHEDULE = {
  days: 'Tuesday & Thursday',
  timeRange: '5:45 PM - 7:15 PM',
  opens: '17:45',
  closes: '19:15',
  ageRange: '4-12',
  minAge: 4,
  maxAge: 12,
};

export function getDefaultAgeRangeLabel(): string {
  return `${DEFAULT_SCHEDULE.minAge}-${DEFAULT_SCHEDULE.maxAge}`;
}
