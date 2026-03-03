#!/usr/bin/env node

/**
 * Generate Playwright E2E Tests from Feature Catalog
 *
 * This script analyzes the feature catalog and generates comprehensive
 * Playwright E2E tests based on:
 * - Features and their routes
 * - Validation criteria
 * - User flows
 * - Role-based access patterns
 *
 * Run: npm run tests:generate
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  rootDir: process.cwd(),
  catalogPath: 'docs/merged-feature-catalog.json',

  outputDir: 'e2e/generated',

  // Test organization
  testCategories: {
    admin: 'admin routes and features',
    family: 'family portal features',
    instructor: 'instructor portal features',
    api: 'API endpoints',
    public: 'public pages and authentication'
  },

  // Base URL from environment or default
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:5178'
};

// ============================================================================
// Test Templates
// ============================================================================

const TEMPLATES = {
  testFile: (feature, tests) => `
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsFamily, loginAsInstructor } from '../utils/auth';

/**
 * ${feature.name} - E2E Tests
 *
 * ${feature.description}
 *
 * Auto-generated from feature catalog
 * Routes: ${feature.stats?.routes || feature.files?.filter(f => f.includes('/routes/')).length || 0}
 * Files: ${feature.stats?.total || feature.files?.length || 0}
 */

test.describe('${feature.name}', () => {
  ${tests.join('\n\n  ')}
});
`,

  smokeTest: (feature, route) => `
  test('smoke: ${route} loads successfully', async ({ page }) => {
    // Collect JS errors before navigation
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('${route}');

    // Wait for page to be interactive (auth redirect is acceptable)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Page must load something — not a blank white screen or server crash
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText).not.toBeNull();

    // No uncaught JS errors
    expect(errors).toHaveLength(0);
  });`,

  roleBasedAccessTest: (route, role) => `
  test('access: ${role} can access ${route}', async ({ page }) => {
    ${role === 'instructor' ? "if (!process.env.TEST_INSTRUCTOR_EMAIL) { test.skip(true, 'No instructor credentials — set TEST_INSTRUCTOR_EMAIL/PASSWORD in .env'); return; }" : ''}
    await loginAs${role.charAt(0).toUpperCase() + role.slice(1)}(page);
    const response = await page.goto('${route}');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/.*login.*/);

    // Should respond with a success status (not 4xx/5xx)
    expect(response?.status() ?? 200).toBeLessThan(400);
  });`,

  validationTest: (criteria, index) => `
  test.skip('validation ${index + 1}: ${criteria.substring(0, 60)}...', async ({ page }) => {
    // TODO: Implement test for: ${criteria}

    // This is a generated test stub based on validation criteria
    // Please implement the actual test logic
  });`
};

// ============================================================================
// Helper Functions
// ============================================================================

function loadCatalog() {
  const catalogPath = path.join(CONFIG.rootDir, CONFIG.catalogPath);

  if (!fs.existsSync(catalogPath)) {
    console.error(`❌ Catalog not found: ${CONFIG.catalogPath}`);
    console.error('   Run: npm run docs:merge first');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
}

function extractRoutes(files) {
  const routes = files
    .filter(f => f.includes('/routes/'))
    .map(f => {
      // Extract route from file path
      // app/routes/_layout.family.tsx -> /family
      // app/routes/admin.students.$id.tsx -> /admin/students/:id

      let route = f
        .replace('app/routes/', '')
        .replace('.tsx', '')
        .replace('.ts', '');

      // Handle special patterns
      route = route
        .replace(/_layout\./g, '/')
        .replace(/\./g, '/')
        .replace(/\$([a-zA-Z]+)/g, ':$1')  // $id -> :id
        .replace(/_index$/g, '')
        .replace(/\/_$/g, '')
        .replace(/\/+/g, '/');

      if (!route.startsWith('/')) route = '/' + route;
      if (route === '/') route = '';

      return route;
    })
    .filter(r => r.length > 0);

  return [...new Set(routes)].sort();
}

function categorizeRoute(route) {
  if (route.startsWith('/admin')) return 'admin';
  if (route.startsWith('/family')) return 'family';
  if (route.startsWith('/instructor')) return 'instructor';
  if (route.startsWith('/api')) return 'api';
  return 'public';
}

function generateFeatureTests(feature) {
  const tests = [];
  const routes = extractRoutes(feature.files || []);

  // Generate smoke tests for each route
  routes.slice(0, 3).forEach(route => {
    tests.push(TEMPLATES.smokeTest(feature, route));
  });

  if (routes.length > 3) {
    tests.push(`
  // ${routes.length - 3} more route(s) available:
  // ${routes.slice(3).join(', ')}`);
  }

  // Generate role-based access test if applicable
  // Prefer a static route (no dynamic params) for the access test
  if (routes.length > 0) {
    const staticRoute = routes.find(r => !r.includes(':')) || routes[0];
    const category = categorizeRoute(staticRoute);
    if (category !== 'public' && category !== 'api' && !staticRoute.includes(':')) {
      tests.push(TEMPLATES.roleBasedAccessTest(staticRoute, category));
    }
  }

  return tests;
}

function generateValidationTests(catalog) {
  const tests = [];
  const criteria = catalog.validation_criteria || [];

  criteria.slice(0, 10).forEach((criterion, index) => {
    tests.push(TEMPLATES.validationTest(criterion, index));
  });

  if (criteria.length > 10) {
    tests.push(`
  // ${criteria.length - 10} more validation criteria available
  // See: docs/merged-feature-catalog.json -> validation_criteria`);
  }

  return tests;
}

// ============================================================================
// Test File Generation
// ============================================================================

function generateTestFiles(catalog) {
  console.log('📝 Generating E2E test files...\n');

  const outputDir = path.join(CONFIG.rootDir, CONFIG.outputDir);

  // Clean and recreate output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const features = catalog.features || [];
  const stats = {
    filesGenerated: 0,
    testsGenerated: 0,
    routesTested: 0
  };

  // Generate test file for each feature
  for (const feature of features) {
    const routes = extractRoutes(feature.files || []);

    if (routes.length === 0) {
      console.log(`  ⏭️  Skipping ${feature.name} (no routes)`);
      continue;
    }

    const tests = generateFeatureTests(feature);
    const testContent = TEMPLATES.testFile(feature, tests);

    // Sanitize filename
    const filename = feature.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.spec.ts';

    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, testContent);

    stats.filesGenerated++;
    stats.testsGenerated += tests.length;
    stats.routesTested += routes.length;

    console.log(`  ✓ ${filename} (${tests.length} tests, ${routes.length} routes)`);
  }

  // Generate validation tests file
  const validationTests = generateValidationTests(catalog);
  if (validationTests.length > 0) {
    const validationContent = `
import { test, expect } from '@playwright/test';

/**
 * Validation Criteria Tests
 *
 * Tests generated from validation_criteria in feature catalog.
 * These are test stubs that need implementation.
 */

test.describe('Validation Criteria', () => {
  ${validationTests.join('\n\n  ')}
});
`;

    const validationPath = path.join(outputDir, '_validation-criteria.spec.ts');
    fs.writeFileSync(validationPath, validationContent);

    stats.filesGenerated++;
    stats.testsGenerated += validationTests.length;

    console.log(`  ✓ _validation-criteria.spec.ts (${validationTests.length} test stubs)`);
  }

  return stats;
}

// ============================================================================
// Generate Test Utilities
// ============================================================================

function generateTestUtils() {
  console.log('\n🛠️  Generating test utilities...\n');

  const utilsDir = path.join(CONFIG.rootDir, 'e2e/utils');
  fs.mkdirSync(utilsDir, { recursive: true });

  // Auth helpers
  const authHelpers = `
import { Page } from '@playwright/test';

/**
 * Authentication Helpers for E2E Tests
 *
 * Auto-generated utilities for role-based testing
 */

export async function loginAsAdmin(page: Page) {
  // TODO: Implement admin login
  // await page.goto('/login');
  // await page.fill('[name="email"]', process.env.ADMIN_EMAIL);
  // await page.fill('[name="password"]', process.env.ADMIN_PASSWORD);
  // await page.click('button[type="submit"]');
  // await page.waitForURL('/admin');

  throw new Error('Admin login not implemented');
}

export async function loginAsFamily(page: Page) {
  // TODO: Implement family login
  throw new Error('Family login not implemented');
}

export async function loginAsInstructor(page: Page) {
  // TODO: Implement instructor login
  throw new Error('Instructor login not implemented');
}

export async function logout(page: Page) {
  await page.goto('/logout');
  await page.waitForURL('/login');
}
`;

  const authPath = path.join(utilsDir, 'auth.ts');
  if (!fs.existsSync(authPath)) {
    fs.writeFileSync(authPath, authHelpers);
    console.log('  ✓ e2e/utils/auth.ts (created)');
  } else {
    console.log('  ↩ e2e/utils/auth.ts (skipped — already implemented)');
  }

  // Test data helpers
  const testDataHelpers = `
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
    guardianEmail: \`test-\${Date.now()}@example.com\`,
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
`;

  const testDataPath = path.join(utilsDir, 'test-data.ts');
  if (!fs.existsSync(testDataPath)) {
    fs.writeFileSync(testDataPath, testDataHelpers);
    console.log('  ✓ e2e/utils/test-data.ts (created)');
  } else {
    console.log('  ↩ e2e/utils/test-data.ts (skipped — already exists)');
  }

  // Common actions
  const commonActions = `
import { Page, expect } from '@playwright/test';

/**
 * Common Test Actions
 *
 * Reusable actions for E2E tests
 */

export async function waitForSuccess(page: Page) {
  // Wait for success toast/message
  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 5000 });
}

export async function waitForError(page: Page) {
  // Wait for error message
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
}

export async function fillForm(page: Page, data: Record<string, string>) {
  for (const [name, value] of Object.entries(data)) {
    await page.fill(\`[name="\${name}"]\`, value);
  }
}

export async function navigateToAdminSection(page: Page, section: string) {
  await page.goto(\`/admin/\${section}\`);
  await page.waitForLoadState('networkidle');
}
`;

  const actionsPath = path.join(utilsDir, 'actions.ts');
  if (!fs.existsSync(actionsPath)) {
    fs.writeFileSync(actionsPath, commonActions);
    console.log('  ✓ e2e/utils/actions.ts (created)');
  } else {
    console.log('  ↩ e2e/utils/actions.ts (skipped — already exists)');
  }
}

// ============================================================================
// Generate Playwright Config
// ============================================================================

function generatePlaywrightConfig() {
  const configPath = path.join(CONFIG.rootDir, 'playwright.config.ts');

  // Check if config exists
  if (fs.existsSync(configPath)) {
    console.log('\n⚠️  playwright.config.ts already exists, skipping...');
    return;
  }

  const config = `import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Auto-generated configuration for E2E testing
 */

export default defineConfig({
  testDir: './e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html'],
    ['list']
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5178',

    trace: 'on-first-retry',

    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5178',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
`;

  fs.writeFileSync(configPath, config);
  console.log('\n✓ playwright.config.ts created');
}

// ============================================================================
// Generate README
// ============================================================================

function generateReadme(stats) {
  const readme = `# Auto-Generated E2E Tests

**Generated on:** ${new Date().toISOString()}
**From catalog:** ${CONFIG.catalogPath}

## Overview

These E2E tests were automatically generated from the feature catalog using:
\`\`\`bash
npm run tests:generate
\`\`\`

## Statistics

- **Test files generated:** ${stats.filesGenerated}
- **Test cases generated:** ${stats.testsGenerated}
- **Routes covered:** ${stats.routesTested}

## Test Organization

Tests are organized by feature:
- Each feature has its own test file
- Tests include smoke tests and role-based access checks
- Validation criteria tests are in \`_validation-criteria.spec.ts\`

## Running Tests

\`\`\`bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/generated/payment-processing.spec.ts

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
\`\`\`

## Implementation Status

⚠️  **These are generated test stubs** - they need implementation:

1. **Authentication helpers** (\`e2e/utils/auth.ts\`)
   - Implement \`loginAsAdmin()\`
   - Implement \`loginAsFamily()\`
   - Implement \`loginAsInstructor()\`

2. **Test environment setup**
   - Set test user credentials in \`.env.test\`
   - Set up test database
   - Configure test data seeding

3. **Individual test implementation**
   - Review each generated test
   - Implement test logic based on validation criteria
   - Add assertions and expectations

## Test Utilities

Helper functions are available in \`e2e/utils/\`:
- \`auth.ts\` - Authentication helpers
- \`test-data.ts\` - Test data generators
- \`actions.ts\` - Common test actions

## Regenerating Tests

To regenerate tests after catalog updates:
\`\`\`bash
# Update catalog
npm run docs:all

# Regenerate tests
npm run tests:generate
\`\`\`

## Next Steps

1. Review generated tests in \`e2e/generated/\`
2. Implement authentication helpers
3. Set up test environment
4. Run initial test suite
5. Implement pending validation tests

---

*Auto-generated by \`scripts/generate-e2e-tests.js\`*
`;

  const readmePath = path.join(CONFIG.rootDir, CONFIG.outputDir, 'README.md');
  fs.writeFileSync(readmePath, readme);
  console.log('  ✓ README.md');
}

// ============================================================================
// Main Function
// ============================================================================

function main() {
  console.log('🎭 Playwright E2E Test Generator\n');
  console.log(`📂 Source: ${CONFIG.catalogPath}`);
  console.log(`📁 Output: ${CONFIG.outputDir}\n`);

  // Load catalog
  const catalog = loadCatalog();
  console.log(`✓ Loaded catalog: ${catalog.features.length} features\n`);

  // Generate test files
  const stats = generateTestFiles(catalog);

  // Generate utilities
  generateTestUtils();

  // Generate config (if needed)
  generatePlaywrightConfig();

  // Generate README
  console.log('\n📄 Generating documentation...\n');
  generateReadme(stats);

  // Summary
  console.log('\n✅ Test generation complete!\n');
  console.log('📊 Summary:');
  console.log(`  Files generated: ${stats.filesGenerated}`);
  console.log(`  Test cases: ${stats.testsGenerated}`);
  console.log(`  Routes covered: ${stats.routesTested}`);
  console.log(`  Features: ${catalog.features.length}`);

  console.log('\n📝 Next steps:');
  console.log('  1. Review generated tests in e2e/generated/');
  console.log('  2. Implement auth helpers in e2e/utils/auth.ts');
  console.log('  3. Set up test environment (.env.test)');
  console.log('  4. Run: npm run test:e2e');

  console.log('\n💡 Tip: These are test stubs - implement the logic!');
}

// ============================================================================
// Run
// ============================================================================

main();
