import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSelfRegistrant,
  getSelfRegistrantByProfileId,
  isSelfRegistrant,
  updateSelfRegistrant,
} from '../self-registration.server';

// Mock the supabase admin client
vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
};

describe('Self-Registration Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSelfRegistrant', () => {
    it('should create a new self-registrant family and student', async () => {
      const mockProfileId = 'profile-123';
      const mockFamilyId = 'family-123';
      const mockStudentId = 'student-123';

      // Mock profile check (no existing family)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // Not found
        }),
      });

      // Mock family creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockFamilyId,
            name: 'John Doe',
            family_type: 'self',
            email: 'john@example.com',
            primary_phone: '1234567890',
          },
          error: null,
        }),
      });

      // Mock student creation
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockStudentId,
            family_id: mockFamilyId,
            profile_id: mockProfileId,
            is_adult: true,
            first_name: 'John',
            last_name: 'Doe',
          },
          error: null,
        }),
      });

      // Mock profile update
      mockSupabaseClient.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      const result = await createSelfRegistrant({
        profileId: mockProfileId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(result.family.family_type).toBe('self');
      expect(result.student.is_adult).toBe(true);
      expect(result.student.profile_id).toBe(mockProfileId);
    });

    it('should return existing self-registrant if already exists', async () => {
      const mockProfileId = 'profile-123';
      const mockFamilyId = 'family-123';
      const mockStudentId = 'student-123';

      // Mock profile check (existing self family)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            family_id: mockFamilyId,
            families: { family_type: 'self' },
          },
          error: null,
        }),
      });

      // Mock family fetch
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockFamilyId,
            family_type: 'self',
          },
          error: null,
        }),
      });

      // Mock student fetch
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockStudentId,
            is_adult: true,
            profile_id: mockProfileId,
          },
          error: null,
        }),
      });

      const result = await createSelfRegistrant({
        profileId: mockProfileId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
      });

      expect(result.student.profile_id).toBe(mockProfileId);
      // Should not have created new records
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(3);
    });

    it('should rollback family creation if student creation fails', async () => {
      const mockProfileId = 'profile-123';
      const mockFamilyId = 'family-123';

      // Mock profile check (no existing family)
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      // Mock family creation (success)
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockFamilyId },
          error: null,
        }),
      });

      // Mock student creation (failure)
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Student creation failed' },
        }),
      });

      // Mock family deletion (rollback)
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      await expect(
        createSelfRegistrant({
          profileId: mockProfileId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
        })
      ).rejects.toThrow('Failed to create student');

      // Verify rollback was called
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('families');
    });
  });

  describe('getSelfRegistrantByProfileId', () => {
    it('should return self-registrant data for valid profile', async () => {
      const mockProfileId = 'profile-123';

      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'student-123',
            profile_id: mockProfileId,
            is_adult: true,
            families: {
              id: 'family-123',
              family_type: 'self',
            },
          },
          error: null,
        }),
      });

      const result = await getSelfRegistrantByProfileId(mockProfileId);

      expect(result).not.toBeNull();
      expect(result?.student.profile_id).toBe(mockProfileId);
      expect(result?.family.family_type).toBe('self');
    });

    it('should return null for non-existent profile', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const result = await getSelfRegistrantByProfileId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('isSelfRegistrant', () => {
    it('should return true for adult self-registrant', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'student-123' },
          error: null,
        }),
      });

      const result = await isSelfRegistrant('profile-123');

      expect(result).toBe(true);
    });

    it('should return false for non-self-registrant', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      const result = await isSelfRegistrant('profile-123');

      expect(result).toBe(false);
    });
  });

  describe('updateSelfRegistrant', () => {
    it('should update contact information for self-registrant', async () => {
      const mockProfileId = 'profile-123';

      // Mock get existing self-registrant
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'student-123',
            first_name: 'John',
            last_name: 'Doe',
            families: {
              id: 'family-123',
              name: 'John Doe',
            },
          },
          error: null,
        }),
      });

      // Mock student update
      mockSupabaseClient.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      // Mock family update
      mockSupabaseClient.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

      // Mock get updated self-registrant
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'student-123',
            email: 'newemail@example.com',
            families: {
              id: 'family-123',
            },
          },
          error: null,
        }),
      });

      const result = await updateSelfRegistrant(mockProfileId, {
        email: 'newemail@example.com',
      });

      expect(result.student.email).toBe('newemail@example.com');
    });

    it('should throw error for non-existent self-registrant', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      });

      await expect(
        updateSelfRegistrant('non-existent', { email: 'test@example.com' })
      ).rejects.toThrow('Self-registrant not found');
    });
  });
});
