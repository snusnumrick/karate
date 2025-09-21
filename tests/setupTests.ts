// Vitest setup for unit/integration tests
// - Lock down env used by CSP/nonce helpers for determinism

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
delete process.env.NONCE_SECRET; // ensure NONCE_SECRET is derived consistently in tests

// JSDOM already provides fetch/Request in Node >=18
// Add additional polyfills here if needed.

