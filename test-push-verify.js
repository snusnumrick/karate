const fetch = require('node:fetch');

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
    
    if (response.status === 401) {
      console.log('✓ Expected 401 Unauthorized (no auth token provided)');
      console.log('✓ Route handler is working - no more "no action" error');
    } else {
      console.log('Response status:', response.status);
    }
    
  } catch (error) {
    console.error('Error testing push verify:', error.message);
  }
}

testPushVerify();