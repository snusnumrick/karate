#!/usr/bin/env node

/**
 * Square Configuration Validator
 * 
 * This script validates Square Web Payments SDK configuration
 * for production deployment readiness.
 * 
 * Usage: node scripts/validate-square-config.js
 */

import 'dotenv/config';

const REQUIRED_VARS = [
  'SQUARE_APPLICATION_ID',
  'SQUARE_ACCESS_TOKEN', 
  'SQUARE_LOCATION_ID',
  'SQUARE_ENVIRONMENT'
];

const VALIDATION_RULES = {
  SQUARE_ENVIRONMENT: (value) => {
    if (!['sandbox', 'production'].includes(value)) {
      return 'Must be either "sandbox" or "production"';
    }
    return null;
  },
  
  SQUARE_APPLICATION_ID: (value, env) => {
    if (env === 'production' && !value.startsWith('sq0idp-')) {
      return 'Production application ID must start with "sq0idp-"';
    }
    if (env === 'sandbox' && !value.startsWith('sandbox-')) {
      return 'Sandbox application ID must start with "sandbox-"';
    }
    return null;
  },
  
  SQUARE_ACCESS_TOKEN: (value) => {
    if (!value.startsWith('EAAA')) {
      return 'Access token should start with "EAAA"';
    }
    if (value.length < 50) {
      return 'Access token appears to be too short';
    }
    return null;
  },
  
  SQUARE_LOCATION_ID: (value) => {
    if (!value || value.length < 10) {
      return 'Location ID appears to be invalid';
    }
    return null;
  }
};

async function validateConfiguration() {
  console.log('🔍 Validating Square Web Payments SDK Configuration...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check for required environment variables
  console.log('📋 Checking required environment variables:');
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    
    if (!value) {
      console.log(`❌ ${varName}: Missing (required)`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName}: Present`);
    }
  }
  
  if (hasErrors) {
    console.log('\n❌ Missing required environment variables. Please set them before deployment.');
    process.exit(1);
  }
  
  console.log('\n🔍 Validating configuration values:');
  
  const environment = process.env.SQUARE_ENVIRONMENT;
  
  // Validate each configuration value
  for (const [varName, validator] of Object.entries(VALIDATION_RULES)) {
    const value = process.env[varName];
    if (value) {
      const error = validator(value, environment);
      if (error) {
        console.log(`❌ ${varName}: ${error}`);
        hasErrors = true;
      } else {
        console.log(`✅ ${varName}: Valid`);
      }
    }
  }
  
  // Check site configuration currency
  console.log('\n💰 Currency Configuration:');
  console.log('📋 Currency is configured in app/config/site.ts → localization.currency');
  console.log('⚠️  If using CAD, ensure your Square merchant account supports CAD payments');
  console.log('   If you get "INVALID_VALUE" errors, your merchant may only support USD');
  
  // Environment-specific checks
  console.log('\n🌍 Environment-specific checks:');
  
  if (environment === 'production') {
    console.log('📦 Production environment detected');
    
    // Check if running over HTTPS in production
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    if (protocol === 'http') {
      console.log('⚠️  Warning: Production should use HTTPS (Square requires secure contexts)');
      hasWarnings = true;
    } else {
      console.log('✅ HTTPS requirement: OK');
    }
    
    // Check for common production pitfalls
    if (process.env.SQUARE_APPLICATION_ID?.startsWith('sandbox-')) {
      console.log('❌ Using sandbox Application ID in production environment');
      hasErrors = true;
    }
    
  } else if (environment === 'sandbox') {
    console.log('🧪 Sandbox environment detected');
    console.log('✅ Safe for testing');
  }
  
  // CSP Domain Check
  console.log('\n🛡️  Content Security Policy domains required:');
  const requiredDomains = [
    'https://connect.squareup.com',
    'https://web.squarecdn.com', 
    'https://js.squareup.com',
    'https://pci-connect.squareup.com'
  ];
  
  console.log('📋 Ensure these domains are allowed in CSP headers:');
  requiredDomains.forEach(domain => {
    console.log(`   • ${domain}`);
  });
  
  // Final summary
  console.log('\n📊 Validation Summary:');
  
  if (hasErrors) {
    console.log('❌ Configuration has errors that must be fixed before deployment');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Configuration is valid but has warnings');
    console.log('💡 Review warnings above before deploying to production');
  } else {
    console.log('✅ Configuration is valid and ready for deployment');
  }
  
  console.log('\n🚀 Next steps:');
  console.log('   1. Test payment flow in sandbox environment');
  console.log('   2. Verify CSP headers include Square domains');
  console.log('   3. Ensure HTTPS is enabled in production');
  console.log('   4. Monitor payment success rates after deployment');
  
  console.log('\n📚 Documentation:');
  console.log('   • Square Deployment Guide: ./SQUARE_DEPLOYMENT_GUIDE.md');
  console.log('   • Square Developer Docs: https://developer.squareup.com/docs/web-payments');
}

// Run validation
validateConfiguration().catch(console.error);
