import assert from 'node:assert';

// Use the built-in fetch available in modern Node versions or fall back to
// node-fetch when running in older environments.
const fetch = globalThis.fetch ?? (await import('node-fetch')).default;

async function testPushVerify() {
  try {
    console.log('Testing POST request to /api/push/verify...');

    const response = await fetch('http://localhost:5173/api/push/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: 'test-endpoint'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    // Ensure the route returns the expected status code so CI can detect issues.
    assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized (no auth token provided)');
    console.log('✓ Expected 401 Unauthorized (no auth token provided)');
    console.log('✓ Route handler is working - no more "no action" error');
  } catch (error) {
    console.error('Error testing push verify:', error);
    process.exit(1);
  }
}

testPushVerify();

