# E2E Test Generation Guide

**Automatically generate Playwright E2E tests from feature catalogs**

## 🎯 Overview

This system automatically generates Playwright E2E test files based on your feature catalog, creating comprehensive test coverage with minimal manual effort.

---

## 🚀 Quick Start

### Generate Tests

```bash
# Generate tests from existing catalog
npm run tests:generate

# Or regenerate everything (catalog + tests)
npm run tests:generate:full
```

### What Gets Generated

```
e2e/
├── generated/
│   ├── payment-processing.spec.ts      (5 tests, 17 routes)
│   ├── family-management.spec.ts       (5 tests, 37 routes)
│   ├── student-management.spec.ts      (5 tests, 18 routes)
│   ├── authentication-user-management.spec.ts
│   ├── ... (24 test files total)
│   ├── _validation-criteria.spec.ts    (11 test stubs)
│   └── README.md
├── utils/
│   ├── auth.ts          (Login helpers)
│   ├── test-data.ts     (Test data generators)
│   └── actions.ts       (Common actions)
└── playwright.config.ts (if not exists)
```

---

## 📊 Generation Results

**From latest run:**
- ✅ **24 test files** generated
- ✅ **109 test cases** created
- ✅ **206 routes** covered
- ✅ **28 features** tested

---

## 📝 Generated Test Types

### 1. Smoke Tests

Basic "does it load?" tests for each route:

```typescript
test('smoke: /admin/payments/ loads successfully', async ({ page }) => {
  await page.goto('/admin/payments/');
  await expect(page).toHaveURL(/\/admin\/payments\/.*$/);

  // Check no critical errors
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.waitForLoadState('networkidle', { timeout: 10000 });
  expect(errors).toHaveLength(0);
});
```

**Purpose:** Catch basic routing and rendering issues

---

### 2. Role-Based Access Tests

Verify proper access control:

```typescript
test('access: admin can access /admin/payments/', async ({ page }) => {
  // TODO: Implement admin login
  // await loginAsAdmin(page);

  await page.goto('/admin/payments/');

  // Should not redirect to login
  await expect(page).not.toHaveURL(/.*login.*/);

  // Should see content (not 404)
  const content = await page.textContent('body');
  expect(content).not.toContain('404');
});
```

**Purpose:** Verify authentication and authorization

---

### 3. Validation Criteria Tests

Test stubs based on your validation criteria:

```typescript
test.skip('validation 1: Payment processing works reliably...', async ({ page }) => {
  // TODO: Implement test for: Payment processing works reliably
  // with Stripe and Square, including webhook event handling

  // This is a generated test stub
  // Please implement the actual test logic
});
```

**Purpose:** Comprehensive feature validation checklist

---

## 🛠️ Implementation Steps

### Step 1: Set Up Test Environment

```bash
# Create .env.test
cat > .env.test <<EOF
E2E_BASE_URL=http://localhost:5178

# Test user credentials
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=test123

TEST_FAMILY_EMAIL=family@test.com
TEST_FAMILY_PASSWORD=test123

TEST_INSTRUCTOR_EMAIL=instructor@test.com
TEST_INSTRUCTOR_PASSWORD=test123
EOF
```

---

### Step 2: Implement Authentication Helpers

Edit `e2e/utils/auth.ts`:

```typescript
export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/admin');
}

export async function loginAsFamily(page: Page) {
  await page.goto('/login');
  await page.fill('[name="email"]', process.env.TEST_FAMILY_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_FAMILY_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL('/family');
}
```

---

### Step 3: Set Up Test Database

```bash
# Option 1: Use separate test database
export DATABASE_URL=postgresql://...test

# Option 2: Seed test data before tests
npx playwright test --global-setup=./e2e/global-setup.ts
```

**Example global setup:**

```typescript
// e2e/global-setup.ts
import { chromium } from '@playwright/test';

async function globalSetup() {
  // Seed test users
  // Create test families
  // Set up test data
}

export default globalSetup;
```

---

### Step 4: Run Initial Tests

```bash
# Run all generated tests
npm run test:e2e

# Run specific feature
npx playwright test e2e/generated/payment-processing.spec.ts

# Run with UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

---

### Step 5: Implement Test Logic

Review each test file and implement TODOs:

```typescript
// Before (generated stub)
test.skip('validation: Payment eligibility checking...', async ({ page }) => {
  // TODO: Implement test
});

// After (implemented)
test('validation: Payment eligibility checking...', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/students/123');

  // Check eligibility indicator
  await expect(page.locator('[data-testid="payment-eligible"]')).toBeVisible();

  // Verify paid-until date calculation
  const paidUntil = await page.textContent('[data-testid="paid-until"]');
  expect(paidUntil).toMatch(/\d{4}-\d{2}-\d{2}/);
});
```

---

## 📁 Test File Organization

### By Feature

Each feature has its own test file:

```
e2e/generated/
├── payment-processing.spec.ts       # Payment features
├── family-management.spec.ts        # Family portal
├── student-management.spec.ts       # Student CRUD
├── authentication-user-management.spec.ts
└── ...
```

### By Priority

| Priority | Files | Focus |
|----------|-------|-------|
| **High** | `authentication-*.spec.ts`<br>`payment-*.spec.ts` | Core functionality |
| **Medium** | `family-*.spec.ts`<br>`student-*.spec.ts` | Main features |
| **Low** | `seo-*.spec.ts`<br>`pwa-*.spec.ts` | Enhancement features |

---

## 🔄 Regeneration Workflow

### When to Regenerate

- ✅ After adding new features
- ✅ After updating routes
- ✅ Monthly or quarterly
- ✅ Before major releases

### How to Regenerate

```bash
# 1. Update feature catalog
npm run docs:all

# 2. Regenerate tests
npm run tests:generate

# 3. Review changes
git diff e2e/generated/

# 4. Commit
git add e2e/
git commit -m "test: regenerate e2e tests"
```

**⚠️ Warning:** Regeneration overwrites `e2e/generated/` directory!

---

## 🎨 Customizing Test Generation

### Add Custom Test Patterns

Edit `scripts/generate-e2e-tests.js`:

```javascript
const TEMPLATES = {
  // Add your custom template
  performanceTest: (feature, route) => `
  test('performance: ${route} loads in <2s', async ({ page }) => {
    const start = Date.now();
    await page.goto('${route}');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });`,

  // Use in generation
  // ...
}
```

### Configure Route Extraction

Modify route patterns:

```javascript
function extractRoutes(files) {
  // Custom logic for your route naming
  // ...
}
```

---

## 📊 Test Coverage Analysis

### Check Coverage

```bash
# Run tests with coverage
npx playwright test --reporter=html

# View coverage report
npx playwright show-report
```

### Generated Coverage

| Category | Coverage |
|----------|----------|
| **Admin routes** | 97 routes → Tests for top features |
| **Family routes** | 28 routes → Full coverage |
| **Instructor routes** | 8 routes → Full coverage |
| **API routes** | 26 routes → Smoke tests |
| **Public routes** | 39 routes → Auth + public pages |

---

## 🐛 Troubleshooting

### "Tests timeout waiting for networkidle"

```typescript
// Increase timeout or use different wait strategy
await page.waitForLoadState('domcontentloaded');
// or
await page.waitForSelector('[data-testid="loaded"]');
```

### "Cannot find element"

```typescript
// Add debug info
await page.screenshot({ path: 'debug.png' });
console.log(await page.content());
```

### "Auth helpers not implemented"

Implement `e2e/utils/auth.ts` following Step 2 above.

---

## 📈 Best Practices

### 1. Use Test IDs

```tsx
// In your components
<button data-testid="submit-payment">Pay</button>

// In tests
await page.click('[data-testid="submit-payment"]');
```

### 2. Independent Tests

Each test should:
- Set up its own data
- Not depend on other tests
- Clean up after itself

### 3. Use Page Objects

```typescript
// e2e/pages/PaymentPage.ts
export class PaymentPage {
  constructor(private page: Page) {}

  async goto(invoiceId: string) {
    await this.page.goto(`/pay/${invoiceId}`);
  }

  async fillPaymentForm(cardNumber: string) {
    await this.page.fill('[data-testid="card-number"]', cardNumber);
  }
}

// In test
const paymentPage = new PaymentPage(page);
await paymentPage.goto('123');
```

### 4. Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 1 : 4, // Parallel workers
  fullyParallel: true,
});
```

---

## 🎯 Next Steps

### Immediate Actions

1. ✅ Run `npm run tests:generate`
2. ✅ Review generated tests in `e2e/generated/`
3. ✅ Implement auth helpers
4. ✅ Set up test environment
5. ✅ Run first test suite

### Short Term (Week 1)

1. Implement authentication tests
2. Implement payment processing tests
3. Set up CI/CD integration
4. Add test database seeding

### Long Term (Month 1)

1. Achieve 80%+ coverage on critical paths
2. Implement all validation criteria tests
3. Add visual regression tests
4. Set up automated test reports

---

## 📚 Examples

### Complete Payment Test

```typescript
test('payment flow: successful Square payment', async ({ page }) => {
  // 1. Login as family
  await loginAsFamily(page);

  // 2. Navigate to invoice
  await page.goto('/family/invoices/123');

  // 3. Click pay button
  await page.click('[data-testid="pay-invoice"]');

  // 4. Fill payment form
  await page.fill('[name="cardNumber"]', '4111111111111111');
  await page.fill('[name="cvv"]', '123');
  await page.fill('[name="postalCode"]', '12345');

  // 5. Submit payment
  await page.click('[data-testid="submit-payment"]');

  // 6. Wait for success
  await page.waitForURL('/payment/success');

  // 7. Verify
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

### Complete Family Registration Test

```typescript
test('family registration: end-to-end flow', async ({ page }) => {
  // 1. Navigate to registration
  await page.goto('/register');

  // 2. Fill family info
  await fillForm(page, {
    guardianName: 'Test Parent',
    email: `test-${Date.now()}@example.com`,
    password: 'Test123!',
    phone: '(555) 123-4567'
  });

  // 3. Submit
  await page.click('[data-testid="submit-registration"]');

  // 4. Verify email sent
  await expect(page.locator('[data-testid="check-email"]')).toBeVisible();

  // 5. Complete email verification (in real test, use test email API)
  // await verifyEmail(email);

  // 6. Login
  await loginAsFamily(page);

  // 7. Verify dashboard
  await expect(page).toHaveURL('/family');
});
```

---

## 🔗 Related Documentation

- [Feature Catalog Guide](./FEATURE_CATALOG_GUIDE.md)
- [Auto-Generation Guide](./AUTO_GENERATION_GUIDE.md)
- [Playwright Documentation](https://playwright.dev)

---

## 💡 Pro Tips

### Tip 1: Use .only for Development

```typescript
test.only('test I am working on', async ({ page }) => {
  // Only this test runs
});
```

### Tip 2: Generate Test Data Helpers

```typescript
// e2e/utils/test-data.ts
export function generateTestStudent() {
  return {
    firstName: 'Test',
    lastName: `Student-${Date.now()}`,
    dateOfBirth: '2015-01-01'
  };
}
```

### Tip 3: Record Tests

```bash
# Record a test flow
npx playwright codegen http://localhost:5178

# Copy generated code to your test file
```

---

**Last Updated:** 2025-10-21
**Generated Tests:** 109 test cases across 24 files
**Coverage:** 206 routes
**Maintenance:** Regenerate after catalog updates
