/**
 * Classifies a Supabase Realtime channel subscription status into a log level.
 *
 * Key insight: CLOSED fires during normal removeChannel() cleanup.
 * Treating it as an error floods Sentry (especially in React StrictMode dev
 * which mounts → cleanups → remounts, triggering CLOSED on every cycle).
 *
 *   SUBSCRIBED          → 'subscribed' (happy path)
 *   CHANNEL_ERROR       → 'error'      (real failure, report to Sentry)
 *   TIMED_OUT           → 'error'      (real failure, report to Sentry)
 *   CLOSED (cleanup)    → 'ignore'     (expected; removeChannel() causes this)
 *   CLOSED (unexpected) → 'warn'       (unexpected but not an error)
 */
export type RealtimeStatusLevel = 'subscribed' | 'error' | 'warn' | 'ignore';

export function classifyRealtimeStatus(
  status: string,
  isCleaningUp: boolean
): RealtimeStatusLevel {
  if (status === 'SUBSCRIBED') return 'subscribed';
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') return 'error';
  if (status === 'CLOSED' && !isCleaningUp) return 'warn';
  return 'ignore';
}
