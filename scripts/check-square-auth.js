#!/usr/bin/env node

/**
 * Verifies Square server credentials by calling Square's Locations and Payments APIs.
 *
 * Usage:
 *   node scripts/check-square-auth.js
 *   DOTENV_CONFIG_PATH=.env.vercel.production node scripts/check-square-auth.js
 */

import 'dotenv/config';
import { SquareClient, SquareEnvironment, SquareError } from 'square';

function getStatusCode(error) {
  if (error instanceof SquareError) {
    return error.statusCode;
  }

  return typeof error?.statusCode === 'number' ? error.statusCode : undefined;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    console.log(`❌ ${name} is not set`);
    process.exit(1);
  }

  return value;
}

async function checkSquareAuth() {
  console.log('🔍 Testing Square API authentication...\n');

  const accessToken = requireEnv('SQUARE_ACCESS_TOKEN');
  const locationId = requireEnv('SQUARE_LOCATION_ID');
  const applicationId = requireEnv('SQUARE_APPLICATION_ID');
  const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';

  if (!['sandbox', 'production'].includes(environment)) {
    console.log('❌ SQUARE_ENVIRONMENT must be either "sandbox" or "production"');
    process.exit(1);
  }

  console.log('📋 Current configuration:');
  console.log(`   Environment: ${environment}`);
  console.log(`   Application ID: ${applicationId.substring(0, 15)}...`);
  console.log(`   Access Token: ${accessToken.substring(0, 6)}...${accessToken.slice(-4)}`);
  console.log(`   Location ID: ${locationId}`);
  console.log('');

  let hasErrors = false;
  if (environment === 'sandbox' && !applicationId.startsWith('sandbox-')) {
    console.log('❌ Sandbox application ID should start with "sandbox-"');
    hasErrors = true;
  }

  if (environment === 'production' && !applicationId.startsWith('sq0idp-')) {
    console.log('❌ Production Web Payments application ID should start with "sq0idp-"');
    hasErrors = true;
  }

  if (!accessToken.startsWith('EAAA')) {
    console.log('❌ Access token should start with "EAAA"');
    hasErrors = true;
  }

  if (hasErrors) {
    console.log('\n❌ Configuration format errors detected. Fix them before testing API calls.');
    process.exit(1);
  }

  const client = new SquareClient({
    token: accessToken,
    environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });

  try {
    console.log('Test 1: Retrieving configured location...');
    const locationResponse = await client.locations.get({ locationId });
    const location = locationResponse.location;

    if (!location) {
      console.log('❌ Location response did not include a location.');
      process.exit(1);
    }

    console.log('✅ Location retrieved successfully');
    console.log(`   Name: ${location.name}`);
    console.log(`   Status: ${location.status}`);
    console.log(`   Currency: ${location.currency}`);
    console.log('');

    console.log('Test 2: Checking payment API access...');
    const payments = await client.payments.list({ locationId, limit: 1 });
    console.log('✅ Payment API is accessible');
    console.log(`   Recent payment rows visible: ${payments.data.length}`);
    console.log('');

    console.log('🎉 Square credentials are authenticated for this environment and location.');
  } catch (error) {
    console.log('❌ Square authentication check failed.\n');

    const statusCode = getStatusCode(error);
    if (statusCode === 401) {
      console.log('Diagnosis: UNAUTHORIZED (401)');
      console.log('Common causes: invalid/revoked token, sandbox token used with production, or production token used with sandbox.');
      console.log('Fix: copy the access token from the same Square application/environment as SQUARE_APPLICATION_ID and SQUARE_LOCATION_ID, then redeploy Vercel.');
    } else if (statusCode === 404) {
      console.log('Diagnosis: NOT FOUND (404)');
      console.log('The location ID does not exist in, or is not visible to, the configured Square token.');
    } else if (statusCode === 403) {
      console.log('Diagnosis: FORBIDDEN (403)');
      console.log('The token authenticated, but it lacks permission for the requested Square resource or location.');
    } else {
      console.log(`Diagnosis: ${getErrorMessage(error)}`);
    }

    if (error instanceof SquareError && error.errors.length > 0) {
      console.log('');
      console.log('Square errors:');
      for (const squareError of error.errors) {
        console.log(`   ${squareError.category ?? 'UNKNOWN'} / ${squareError.code ?? 'UNKNOWN'}: ${squareError.detail ?? ''}`);
      }
    }

    process.exit(1);
  }
}

checkSquareAuth().catch((error) => {
  console.error('Unexpected Square auth check failure:', error);
  process.exit(1);
});
