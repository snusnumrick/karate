import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, getTodayLocalDateString } from '~/utils/misc';

describe('formatDate', () => {
  describe('timezone-safe date parsing', () => {
    it('parses date-only strings (YYYY-MM-DD) in local timezone', () => {
      const result = formatDate('2024-01-15', { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2024-01-15');
    });

    it('parses date-only strings without timezone shift', () => {
      // Even if user is in EST (UTC-5), Jan 15 should remain Jan 15
      const result = formatDate('2024-01-15', { formatString: 'MMMM d, yyyy' });
      expect(result).toContain('January 15');
      expect(result).toContain('2024');
    });

    it('handles ISO datetime strings with parseISO', () => {
      const result = formatDate('2024-01-15T14:30:00Z', { formatString: 'yyyy-MM-dd HH:mm' });
      // This will vary based on timezone, but should be valid
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('handles Date objects', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 in local time
      const result = formatDate(date, { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2024-01-15');
    });
  });

  describe('format string options', () => {
    it('formats with custom format string', () => {
      const result = formatDate('2024-03-15', { formatString: 'EEEE, MMMM d, yyyy' });
      expect(result).toContain('March 15, 2024');
      expect(result).toContain('Friday');
    });

    it('formats with short format', () => {
      const result = formatDate('2024-03-15', { formatString: 'MMM d, yyyy' });
      expect(result).toBe('Mar 15, 2024');
    });

    it('formats with PPP format', () => {
      const result = formatDate('2024-03-15', { formatString: 'PPP' });
      expect(result).toContain('March 15');
      expect(result).toContain('2024');
    });

    it('formats month and year only', () => {
      const result = formatDate('2024-03-15', { formatString: 'MMMM yyyy' });
      expect(result).toBe('March 2024');
    });
  });

  describe('Intl.DateTimeFormat (no format string)', () => {
    it('uses default date formatting', () => {
      const result = formatDate('2024-03-15');
      expect(result).toMatch(/Mar.*15.*2024/);
    });

    it('formats as datetime when type is datetime', () => {
      const result = formatDate('2024-03-15', { type: 'datetime' });
      // Should include time portion
      expect(result).toMatch(/Mar.*15.*2024/);
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should have time
    });
  });

  describe('edge cases', () => {
    it('returns N/A for null', () => {
      expect(formatDate(null)).toBe('N/A');
    });

    it('returns N/A for undefined', () => {
      expect(formatDate(undefined)).toBe('N/A');
    });

    it('returns Invalid Date for invalid date string', () => {
      expect(formatDate('not-a-date')).toBe('Invalid Date');
    });

    it('returns Invalid Date for invalid date object', () => {
      expect(formatDate(new Date('invalid'))).toBe('Invalid Date');
    });

    it('handles leap year dates correctly', () => {
      const result = formatDate('2024-02-29', { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2024-02-29');
    });

    it('handles end of year dates correctly', () => {
      const result = formatDate('2024-12-31', { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2024-12-31');
    });

    it('handles start of year dates correctly', () => {
      const result = formatDate('2024-01-01', { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2024-01-01');
    });
  });

  describe('locale support', () => {
    it('uses en-CA locale by default', () => {
      const result = formatDate('2024-03-15', { formatString: 'MMMM d, yyyy' });
      // Should format as "March 15, 2024"
      expect(result).toContain('March 15, 2024');
    });

    it('respects custom locale option', () => {
      const result = formatDate('2024-03-15', { locale: 'en-US', formatString: 'MMMM d, yyyy' });
      expect(result).toContain('March 15, 2024');
    });
  });

  describe('timezone consistency', () => {
    it('consistently parses same date string to same output', () => {
      const result1 = formatDate('2024-01-15', { formatString: 'yyyy-MM-dd' });
      const result2 = formatDate('2024-01-15', { formatString: 'yyyy-MM-dd' });
      expect(result1).toBe(result2);
    });

    it('does not shift dates by one day for date-only strings', () => {
      // This was the bug we fixed - dates appearing a day earlier
      const dates = [
        '2024-01-01',
        '2024-06-15',
        '2024-12-31',
      ];

      dates.forEach(dateStr => {
        const result = formatDate(dateStr, { formatString: 'yyyy-MM-dd' });
        expect(result).toBe(dateStr);
      });
    });

    it('handles date-only strings with yyyy-MM-dd format using manual extraction', () => {
      // This tests the specific fix where we manually extract components
      // for yyyy-MM-dd format to avoid timezone issues
      const result = formatDate('2025-10-16', { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2025-10-16');
    });

    it('formats Date objects correctly with yyyy-MM-dd format', () => {
      // Test that local Date objects also work correctly
      const date = new Date(2025, 9, 16); // October 16, 2025 (month is 0-indexed)
      const result = formatDate(date, { formatString: 'yyyy-MM-dd' });
      expect(result).toBe('2025-10-16');
    });

    it('preserves local date when formatting with other date-fns formats', () => {
      // Verify that other formats also work correctly with date-only strings
      const result = formatDate('2025-10-16', { formatString: 'MMM d, yyyy' });
      expect(result).toContain('Oct 16, 2025');
    });

    it('handles dates at month boundaries without shifting', () => {
      // Test critical boundary dates
      const lastDayOfMonth = formatDate('2025-10-31', { formatString: 'yyyy-MM-dd' });
      const firstDayOfMonth = formatDate('2025-11-01', { formatString: 'yyyy-MM-dd' });

      expect(lastDayOfMonth).toBe('2025-10-31');
      expect(firstDayOfMonth).toBe('2025-11-01');
    });

    it('maintains consistency between server and client date formatting', () => {
      // Simulate the server-client scenario:
      // Server creates a local date, client receives and formats it
      const serverDate = new Date(2025, 9, 16); // Local date on server

      // Simulate JSON serialization (would convert to ISO string)
      // Then format it back to yyyy-MM-dd
      const clientFormatted = formatDate(serverDate, { formatString: 'yyyy-MM-dd' });

      expect(clientFormatted).toBe('2025-10-16');
    });
  });
});

describe('getTodayLocalDateString', () => {
  beforeEach(() => {
    // Mock Date to return a consistent value
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns date in YYYY-MM-DD format', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-03-15T14:30:00-07:00')); // March 15, 2024, 2:30 PM PDT
    const result = getTodayLocalDateString('America/Vancouver');
    expect(result).toBe('2024-03-15');
  });

  it('pads single-digit months with zero', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-01-15T12:00:00-08:00'));
    const result = getTodayLocalDateString('America/Vancouver');
    expect(result).toBe('2024-01-15');
  });

  it('pads single-digit days with zero', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-03-05T12:00:00-08:00'));
    const result = getTodayLocalDateString('America/Vancouver');
    expect(result).toBe('2024-03-05');
  });

  it('handles start of year correctly', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-01-01T12:00:00-08:00'));
    const result = getTodayLocalDateString('America/Vancouver');
    expect(result).toBe('2024-01-01');
  });

  it('handles end of year correctly', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-12-31T12:00:00-08:00'));
    const result = getTodayLocalDateString('America/Vancouver');
    expect(result).toBe('2024-12-31');
  });

  it('handles leap year correctly', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-02-29T12:00:00-08:00'));
    const result = getTodayLocalDateString('America/Vancouver');
    expect(result).toBe('2024-02-29');
  });

  it('returns local date regardless of time', () => {
    // Test at midnight PDT (March 15 is during daylight time)
    vi.setSystemTime(new Date('2024-03-15T00:00:00-07:00'));
    expect(getTodayLocalDateString('America/Vancouver')).toBe('2024-03-15');

    // Test at end of day PDT
    vi.setSystemTime(new Date('2024-03-15T23:59:59-07:00'));
    expect(getTodayLocalDateString('America/Vancouver')).toBe('2024-03-15');
  });

  it('generates format compatible with database queries', () => {
    // Use ISO string with explicit time in PST to avoid timezone issues
    vi.setSystemTime(new Date('2024-03-15T12:00:00-07:00'));
    const result = getTodayLocalDateString('America/Vancouver');
    // Should match YYYY-MM-DD format expected by database
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe('timezone handling', () => {
    it('respects explicit timezone parameter', () => {
      // Set system time to Oct 8, 2025, 10:42 PM PST
      // This is Oct 9, 2025, 5:42 AM UTC
      vi.setSystemTime(new Date('2025-10-09T05:42:00Z'));

      // With Pacific timezone, should return Oct 8
      const resultPST = getTodayLocalDateString('America/Vancouver');
      expect(resultPST).toBe('2025-10-08');

      // With UTC timezone, should return Oct 9
      const resultUTC = getTodayLocalDateString('UTC');
      expect(resultUTC).toBe('2025-10-09');
    });

    it('handles edge case when PST is yesterday but UTC is today', () => {
      // Critical bug scenario: Late night PST vs early morning UTC
      // Oct 8, 2025, 11:30 PM PST = Oct 9, 2025, 6:30 AM UTC
      vi.setSystemTime(new Date('2025-10-09T06:30:00Z'));

      const resultPST = getTodayLocalDateString('America/Vancouver');
      expect(resultPST).toBe('2025-10-08');

      const resultUTC = getTodayLocalDateString('UTC');
      expect(resultUTC).toBe('2025-10-09');
    });

    it('handles timezone edge case at midnight UTC', () => {
      // Midnight UTC = 4/5 PM previous day PST (depending on DST)
      vi.setSystemTime(new Date('2025-10-09T00:00:00Z'));

      const resultPST = getTodayLocalDateString('America/Vancouver');
      const resultUTC = getTodayLocalDateString('UTC');

      expect(resultPST).toBe('2025-10-08');
      expect(resultUTC).toBe('2025-10-09');
    });

    it('handles different timezones across the world', () => {
      // Jan 1, 2025, 2:00 AM UTC
      vi.setSystemTime(new Date('2025-01-01T02:00:00Z'));

      const tokyo = getTodayLocalDateString('Asia/Tokyo'); // UTC+9
      const newYork = getTodayLocalDateString('America/New_York'); // UTC-5
      const london = getTodayLocalDateString('Europe/London'); // UTC+0

      expect(tokyo).toBe('2025-01-01'); // 11:00 AM
      expect(newYork).toBe('2024-12-31'); // 9:00 PM previous day
      expect(london).toBe('2025-01-01'); // 2:00 AM
    });

    it('handles DST transition - spring forward', () => {
      // March 9, 2025, 2:00 AM PST -> 3:00 AM PDT (spring forward)
      // Set time to 10:00 AM UTC on March 9 (2:00 AM PST, which becomes 3:00 AM PDT)
      vi.setSystemTime(new Date('2025-03-09T10:00:00Z'));

      const result = getTodayLocalDateString('America/Vancouver');
      expect(result).toBe('2025-03-09');
    });

    it('handles DST transition - fall back', () => {
      // November 2, 2025, 2:00 AM PDT -> 1:00 AM PST (fall back)
      vi.setSystemTime(new Date('2025-11-02T09:00:00Z'));

      const result = getTodayLocalDateString('America/Vancouver');
      expect(result).toBe('2025-11-02');
    });

    it('fallback to system timezone when no timezone specified', () => {
      // When no timezone is provided, it uses siteConfig timezone (America/Vancouver)
      // Use ISO string to ensure consistent timezone handling
      vi.setSystemTime(new Date('2025-03-15T14:30:00-07:00')); // March 15, 2025, 2:30 PM PDT

      const result = getTodayLocalDateString();
      expect(result).toBe('2025-03-15');
    });

    it('uses siteConfig locale for formatting', () => {
      // The locale from siteConfig should be used
      // This test ensures the function respects the locale setting
      vi.setSystemTime(new Date('2025-03-15T12:00:00Z'));

      const result = getTodayLocalDateString('America/Vancouver');
      // Should return valid YYYY-MM-DD regardless of locale
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles year boundary with timezone difference', () => {
      // Dec 31, 2024, 11:00 PM PST = Jan 1, 2025, 7:00 AM UTC
      vi.setSystemTime(new Date('2025-01-01T07:00:00Z'));

      const resultPST = getTodayLocalDateString('America/Vancouver');
      const resultUTC = getTodayLocalDateString('UTC');

      expect(resultPST).toBe('2024-12-31');
      expect(resultUTC).toBe('2025-01-01');
    });
  });
});
