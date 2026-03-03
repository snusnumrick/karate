import { describe, it, expect } from 'vitest';
import { classifyRealtimeStatus } from '~/utils/realtime-channel';

describe('classifyRealtimeStatus', () => {
  describe('SUBSCRIBED', () => {
    it('returns "subscribed" when channel connects successfully', () => {
      expect(classifyRealtimeStatus('SUBSCRIBED', false)).toBe('subscribed');
      expect(classifyRealtimeStatus('SUBSCRIBED', true)).toBe('subscribed');
    });
  });

  describe('CHANNEL_ERROR', () => {
    it('returns "error" regardless of cleanup state', () => {
      expect(classifyRealtimeStatus('CHANNEL_ERROR', false)).toBe('error');
      expect(classifyRealtimeStatus('CHANNEL_ERROR', true)).toBe('error');
    });

    it('is a real failure — must reach Sentry via console.error', () => {
      // Verify it is NOT silenced (not 'ignore') even during cleanup,
      // so production auth failures or network errors are always visible.
      expect(classifyRealtimeStatus('CHANNEL_ERROR', true)).not.toBe('ignore');
    });
  });

  describe('TIMED_OUT', () => {
    it('returns "error" regardless of cleanup state', () => {
      expect(classifyRealtimeStatus('TIMED_OUT', false)).toBe('error');
      expect(classifyRealtimeStatus('TIMED_OUT', true)).toBe('error');
    });
  });

  describe('CLOSED', () => {
    it('returns "ignore" during cleanup — removeChannel() always triggers CLOSED', () => {
      // This is the core regression: React StrictMode mounts→cleans→remounts,
      // so cleanup fires on every mount cycle. CLOSED here is expected and
      // must NOT be logged as console.error (which Sentry captures).
      expect(classifyRealtimeStatus('CLOSED', true)).toBe('ignore');
    });

    it('returns "warn" when CLOSED outside cleanup — genuinely unexpected', () => {
      // If the channel closes without our code calling removeChannel,
      // that is worth a warning but not a Sentry error.
      expect(classifyRealtimeStatus('CLOSED', false)).toBe('warn');
    });

    it('is NOT an error in either case — never reaches Sentry as error', () => {
      expect(classifyRealtimeStatus('CLOSED', false)).not.toBe('error');
      expect(classifyRealtimeStatus('CLOSED', true)).not.toBe('error');
    });
  });

  describe('unknown statuses', () => {
    it('returns "ignore" for unrecognised statuses', () => {
      expect(classifyRealtimeStatus('JOINING', false)).toBe('ignore');
      expect(classifyRealtimeStatus('LEAVING', false)).toBe('ignore');
      expect(classifyRealtimeStatus('', false)).toBe('ignore');
    });
  });
});
