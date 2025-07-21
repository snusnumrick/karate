#!/usr/bin/env node

/**
 * VAPID Key Generator Script
 * 
 * This script generates new VAPID keys for push notifications.
 * Run this when you need to regenerate keys due to VAPID credential mismatches.
 * 
 * Usage: node scripts/generate-vapid-keys.js
 */

const webpush = require('web-push');

function generateVAPIDKeys() {
  console.log('🔑 Generating new VAPID keys...\n');
  
  const vapidKeys = webpush.generateVAPIDKeys();
  
  console.log('✅ New VAPID keys generated successfully!\n');
  console.log('📋 Add these to your .env file:\n');
  console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
  console.log('VAPID_SUBJECT=mailto:your-email@example.com');
  console.log('\n⚠️  Important Notes:');
  console.log('1. Replace "your-email@example.com" with your actual contact email');
  console.log('2. Restart your application after updating the .env file');
  console.log('3. Clear all existing push subscriptions (they will be invalid)');
  console.log('4. Users will need to re-subscribe to push notifications');
  console.log('\n🔧 To clear existing subscriptions, visit: /admin/push-diagnostics');
}

// Check if web-push is available
try {
  generateVAPIDKeys();
} catch (error) {
  console.error('❌ Error generating VAPID keys:', error.message);
  console.log('\n💡 Make sure web-push is installed:');
  console.log('npm install web-push');
  process.exit(1);
}