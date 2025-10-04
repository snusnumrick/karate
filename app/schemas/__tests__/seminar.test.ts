import { describe, it, expect } from 'vitest';
import {
  createSeminarSchema,
  createSeminarSeriesSchema,
  selfRegistrantIntakeSchema,
  seminarRegistrationSchema,
} from '../seminar';

describe('Seminar Schemas', () => {
  describe('createSeminarSchema', () => {
    it('should validate a valid seminar', () => {
      const validSeminar = {
        name: 'Test Seminar',
        description: 'A test seminar',
        engagement_type: 'seminar' as const,
        audience_scope: 'adults' as const,
        duration_minutes: 90,
        is_active: true,
      };

      const result = createSeminarSchema.safeParse(validSeminar);
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const invalid = {
        engagement_type: 'seminar' as const,
      };

      const result = createSeminarSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should validate slug format', () => {
      const invalidSlug = {
        name: 'Test Seminar',
        slug: 'Invalid Slug!',
        engagement_type: 'seminar' as const,
      };

      const result = createSeminarSchema.safeParse(invalidSlug);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('lowercase');
      }
    });

    it('should accept valid slug format', () => {
      const validSlug = {
        name: 'Test Seminar',
        slug: 'test-seminar-2025',
        engagement_type: 'seminar' as const,
      };

      const result = createSeminarSchema.safeParse(validSlug);
      expect(result.success).toBe(true);
    });

    it('should validate age range', () => {
      const invalidAge = {
        name: 'Test Seminar',
        engagement_type: 'seminar' as const,
        min_age: 18,
        max_age: 10, // max < min
      };

      const result = createSeminarSchema.safeParse(invalidAge);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('age');
      }
    });

    it('should accept valid age range', () => {
      const validAge = {
        name: 'Test Seminar',
        engagement_type: 'seminar' as const,
        min_age: 18,
        max_age: 65,
      };

      const result = createSeminarSchema.safeParse(validAge);
      expect(result.success).toBe(true);
    });

    it('should reject negative pricing', () => {
      const negativePricing = {
        name: 'Test Seminar',
        engagement_type: 'seminar' as const,
        single_purchase_price_cents: -100,
      };

      const result = createSeminarSchema.safeParse(negativePricing);
      expect(result.success).toBe(false);
    });

    it('should accept valid enum values', () => {
      const validEnums = {
        name: 'Test Seminar',
        engagement_type: 'seminar' as const,
        ability_category: 'adaptive' as const,
        delivery_format: 'group' as const,
        audience_scope: 'mixed' as const,
      };

      const result = createSeminarSchema.safeParse(validEnums);
      expect(result.success).toBe(true);
    });

    it('should set default values', () => {
      const minimal = {
        name: 'Test Seminar',
        engagement_type: 'seminar' as const,
      };

      const result = createSeminarSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audience_scope).toBe('youth');
        expect(result.data.duration_minutes).toBe(60);
        expect(result.data.sessions_per_week).toBe(1);
      }
    });
  });

  describe('createSeminarSeriesSchema', () => {
    it('should validate a valid series', () => {
      const validSeries = {
        program_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Fall 2025 Series',
        series_label: 'Fall 2025',
        series_start_on: '2025-09-01',
        series_end_on: '2025-12-15',
        series_session_quota: 12,
        is_active: true,
      };

      const result = createSeminarSeriesSchema.safeParse(validSeries);
      expect(result.success).toBe(true);
    });

    it('should require program_id', () => {
      const invalid = {
        name: 'Fall Series',
        series_label: 'Fall 2025',
        series_start_on: '2025-09-01',
        series_end_on: '2025-12-15',
        series_session_quota: 12,
      };

      const result = createSeminarSeriesSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('program_id');
      }
    });

    it('should validate date range', () => {
      const invalidDates = {
        program_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Series',
        series_label: 'Test',
        series_start_on: '2025-12-15',
        series_end_on: '2025-09-01', // end before start
        series_session_quota: 12,
      };

      const result = createSeminarSeriesSchema.safeParse(invalidDates);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('date');
      }
    });

    it('should require at least one session', () => {
      const noSessions = {
        program_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Series',
        series_label: 'Test',
        series_start_on: '2025-09-01',
        series_end_on: '2025-12-15',
        series_session_quota: 0,
      };

      const result = createSeminarSeriesSchema.safeParse(noSessions);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('session');
      }
    });

    it('should validate capacity constraints', () => {
      const invalidCapacity = {
        program_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Series',
        series_label: 'Test',
        series_start_on: '2025-09-01',
        series_end_on: '2025-12-15',
        series_session_quota: 12,
        min_capacity: 20,
        max_capacity: 10, // max < min
      };

      const result = createSeminarSeriesSchema.safeParse(invalidCapacity);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('capacity');
      }
    });
  });

  describe('selfRegistrantIntakeSchema', () => {
    it('should validate a valid self-registrant', () => {
      const valid = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        waiverAcknowledged: true,
      };

      const result = selfRegistrantIntakeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should require all mandatory fields', () => {
      const incomplete = {
        firstName: 'John',
        waiverAcknowledged: true,
      };

      const result = selfRegistrantIntakeSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('should validate email format', () => {
      const invalidEmail = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        phone: '1234567890',
        waiverAcknowledged: true,
      };

      const result = selfRegistrantIntakeSchema.safeParse(invalidEmail);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('should validate phone number length', () => {
      const shortPhone = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123',
        waiverAcknowledged: true,
      };

      const result = selfRegistrantIntakeSchema.safeParse(shortPhone);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('phone');
      }
    });

    it('should require waiver acknowledgement to be true', () => {
      const noWaiver = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        waiverAcknowledged: false,
      };

      const result = selfRegistrantIntakeSchema.safeParse(noWaiver);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('waiver');
      }
    });

    it('should accept optional emergency contact', () => {
      const withEmergency = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        emergencyContact: 'Jane Doe - 0987654321',
        waiverAcknowledged: true,
      };

      const result = selfRegistrantIntakeSchema.safeParse(withEmergency);
      expect(result.success).toBe(true);
    });
  });

  describe('seminarRegistrationSchema', () => {
    it('should validate registration with studentId', () => {
      const valid = {
        seriesId: '123e4567-e89b-12d3-a456-426614174000',
        studentId: '123e4567-e89b-12d3-a456-426614174001',
        waiverIds: [],
      };

      const result = seminarRegistrationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate registration with selfRegistrant', () => {
      const valid = {
        seriesId: '123e4567-e89b-12d3-a456-426614174000',
        selfRegistrant: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
          waiverAcknowledged: true,
        },
        waiverIds: [],
      };

      const result = seminarRegistrationSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should require either studentId or selfRegistrant', () => {
      const invalid = {
        seriesId: '123e4567-e89b-12d3-a456-426614174000',
        waiverIds: [],
      };

      const result = seminarRegistrationSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('student');
      }
    });

    it('should validate UUID format for seriesId', () => {
      const invalidUuid = {
        seriesId: 'not-a-uuid',
        studentId: '123e4567-e89b-12d3-a456-426614174001',
      };

      const result = seminarRegistrationSchema.safeParse(invalidUuid);
      expect(result.success).toBe(false);
    });

    it('should accept optional payment method and waiver IDs', () => {
      const withOptionals = {
        seriesId: '123e4567-e89b-12d3-a456-426614174000',
        studentId: '123e4567-e89b-12d3-a456-426614174001',
        paymentMethodId: 'pm_123',
        waiverIds: ['123e4567-e89b-12d3-a456-426614174002'],
      };

      const result = seminarRegistrationSchema.safeParse(withOptionals);
      expect(result.success).toBe(true);
    });
  });
});
