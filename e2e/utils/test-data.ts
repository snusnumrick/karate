
/**
 * Test Data Helpers
 *
 * Utilities for creating and managing test data
 */

export const testUsers = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'test123'
  },
  family: {
    email: process.env.TEST_FAMILY_EMAIL || 'family@test.com',
    password: process.env.TEST_FAMILY_PASSWORD || 'test123'
  },
  instructor: {
    email: process.env.TEST_INSTRUCTOR_EMAIL || 'instructor@test.com',
    password: process.env.TEST_INSTRUCTOR_PASSWORD || 'test123'
  }
};

export function generateTestFamily() {
  return {
    guardianName: 'Test Guardian',
    guardianEmail: `test-${Date.now()}@example.com`,
    phone: '(555) 123-4567',
    address: '123 Test St',
    city: 'Victoria',
    province: 'BC',
    postalCode: 'V1A 2B3'
  };
}

export function generateTestStudent() {
  return {
    firstName: 'Test',
    lastName: 'Student',
    dateOfBirth: '2015-01-01',
    beltLevel: 'White',
    medicalNotes: ''
  };
}
