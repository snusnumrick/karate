#!/usr/bin/env node

/**
 * AI-Enhanced Feature Catalog Generator
 *
 * This version uses Google Gemini API to analyze code and generate
 * meaningful descriptions instead of generic ones.
 *
 * Requirements:
 * - GEMINI_API_KEY in environment (from .env or export)
 *
 * Run: npm run docs:generate:ai
 * Or: GEMINI_API_KEY=xxx node scripts/generate-feature-catalog-ai.js
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  rootDir: process.cwd(),
  output: 'docs/ai-generated-feature-catalog.json',

  // Use existing model from site config
  aiModel: 'gemini-2.5-flash', // Fast model for documentation

  // Feature detection patterns (same as basic script)
  featurePatterns: {
    'Authentication & User Management': {
      routePatterns: ['**/routes/**/*auth*.{ts,tsx}', '**/routes/**/*login*.{ts,tsx}', '**/routes/**/logout*.{ts,tsx}'],
      servicePatterns: ['**/services/*auth*.server.ts'],
      utilPatterns: ['**/utils/*auth*.{ts,tsx}']
    },
    'Payment Processing': {
      routePatterns: ['**/routes/**/*payment*.{ts,tsx}', '**/routes/**/*pay*.{ts,tsx}'],
      servicePatterns: ['**/services/payments/**/*.server.ts', '**/services/*payment*.server.ts'],
      componentPatterns: ['**/components/**/*Payment*.{ts,tsx}', '**/components/payment/**/*.{ts,tsx}']
    },
    'Family Management': {
      routePatterns: ['**/routes/**/*families*.{ts,tsx}', '**/routes/**/*family*.{ts,tsx}'],
      servicePatterns: ['**/services/*family*.server.ts'],
      componentPatterns: ['**/components/*Family*.{ts,tsx}']
    },
    'Guardian Management': {
      routePatterns: ['**/routes/**/*guardian*.{ts,tsx}'],
      servicePatterns: ['**/services/*guardian*.server.ts'],
      componentPatterns: ['**/components/*Guardian*.{ts,tsx}']
    },
    'Student Management': {
      routePatterns: ['**/routes/**/*student*.{ts,tsx}', '**/routes/**/*belt*.{ts,tsx}'],
      servicePatterns: ['**/services/*student*.server.ts'],
      componentPatterns: ['**/components/*Student*.{ts,tsx}']
    },
    'Invoice Management': {
      routePatterns: ['**/routes/**/*invoice*.{ts,tsx}'],
      servicePatterns: ['**/services/*invoice*.server.ts'],
      componentPatterns: ['**/components/*Invoice*.{ts,tsx}']
    },
    'Waiver System': {
      routePatterns: ['**/routes/**/*waiver*.{ts,tsx}'],
      servicePatterns: ['**/services/*waiver*.server.ts'],
      componentPatterns: ['**/components/**/*Waiver*.{ts,tsx}', '**/components/pdf/*Waiver*.{ts,tsx}']
    },
    'Event Management': {
      routePatterns: ['**/routes/**/*event*.{ts,tsx}'],
      servicePatterns: ['**/services/*event*.server.ts'],
      componentPatterns: ['**/components/*Event*.{ts,tsx}']
    },
    'Attendance System': {
      routePatterns: ['**/routes/**/*attendance*.{ts,tsx}'],
      servicePatterns: ['**/services/*attendance*.server.ts']
    },
    'Messaging System': {
      routePatterns: ['**/routes/**/*message*.{ts,tsx}'],
      componentPatterns: ['**/components/*Message*.{ts,tsx}', '**/components/*Conversation*.{ts,tsx}']
    },
    'Discount System': {
      routePatterns: ['**/routes/**/*discount*.{ts,tsx}'],
      servicePatterns: ['**/services/*discount*.server.ts', '**/services/*auto-discount*.server.ts'],
      utilPatterns: ['**/utils/*discount*.{ts,tsx}']
    },
    'Calendar & Scheduling': {
      routePatterns: ['**/routes/**/*calendar*.{ts,tsx}', '**/routes/**/*session*.{ts,tsx}'],
      componentPatterns: ['**/components/calendar/**/*.{ts,tsx}']
    },
    'Store & Products': {
      routePatterns: ['**/routes/**/store*.{ts,tsx}', '**/routes/**/*product*.{ts,tsx}', '**/routes/**/*order*.{ts,tsx}']
    },
    'Program & Class Management': {
      routePatterns: ['**/routes/**/*program*.{ts,tsx}', '**/routes/**/*class*.{ts,tsx}'],
      servicePatterns: ['**/services/*program*.server.ts', '**/services/*class*.server.ts']
    },
    'Enrollment Management': {
      routePatterns: ['**/routes/**/*enrollment*.{ts,tsx}'],
      servicePatterns: ['**/services/*enrollment*.server.ts']
    },
    'AI Database Chat': {
      routePatterns: ['**/routes/**/db-chat*.{ts,tsx}'],
      utilPatterns: ['**/utils/*retrieve*.{ts,tsx}']
    },
    'Push Notifications': {
      routePatterns: ['**/routes/**/api.push*.{ts,tsx}', '**/routes/**/*notification*.{ts,tsx}'],
      utilPatterns: ['**/utils/*push*.{ts,tsx}', '**/utils/*notification*.{ts,tsx}'],
      componentPatterns: ['**/components/*Notification*.{ts,tsx}']
    },
    'PWA Support': {
      routePatterns: ['**/routes/**/*pwa*.{ts,tsx}'],
      componentPatterns: ['**/components/*PWA*.{ts,tsx}', '**/components/*ServiceWorker*.{ts,tsx}', '**/components/*Offline*.{ts,tsx}']
    },
    'Theme & UI': {
      componentPatterns: ['**/components/*theme*.{ts,tsx}', '**/components/*mode-toggle*.{ts,tsx}', '**/components/ui/**/*.{ts,tsx}']
    }
  }
};

// ============================================================================
// AI Integration with Google Gemini
// ============================================================================

let genAI = null;
let model = null;

function initializeAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY not found in environment');
    console.warn('   Set it in .env file or export GEMINI_API_KEY=your_key');
    console.warn('   Falling back to basic descriptions...\n');
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: CONFIG.aiModel });
    console.log('✅ AI initialized with model:', CONFIG.aiModel);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize AI:', error.message);
    return false;
  }
}

async function analyzeFeatureWithAI(featureName, files) {
  if (!model) {
    // Fallback to basic description
    return {
      description: `Manages ${featureName.toLowerCase()} functionality across ${files.length} files`,
      capabilities: ['Route handling and user interface', 'Backend service logic', 'Component rendering'],
      ai_generated: false
    };
  }

  try {
    // Read sample files (max 3 to avoid token limits)
    const sampleFiles = files.slice(0, 3).map(file => {
      try {
        const fullPath = path.join(CONFIG.rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Take first 800 characters to keep context reasonable
        return {
          path: file,
          content: content.substring(0, 800).trim()
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    if (sampleFiles.length === 0) {
      throw new Error('No readable files');
    }

    const prompt = `Analyze this feature from a karate school management system.

Feature Name: ${featureName}
Total Files: ${files.length}
Sample Files (showing ${sampleFiles.length}):

${sampleFiles.map(f => `
=== ${f.path} ===
${f.content}
`).join('\n---\n')}

Generate a concise technical summary:
1. Description: One clear sentence (max 100 chars) explaining what this feature does
2. Capabilities: 3-5 bullet points of key functionality

Respond ONLY with valid JSON in this exact format:
{
  "description": "Brief one-sentence description here",
  "capabilities": ["Capability 1", "Capability 2", "Capability 3"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\s*$/g, '');
    }

    const parsed = JSON.parse(jsonText);

    return {
      description: parsed.description || `Manages ${featureName.toLowerCase()}`,
      capabilities: parsed.capabilities || [],
      ai_generated: true
    };

  } catch (error) {
    console.warn(`    ⚠️  AI analysis failed: ${error.message}`);
    // Fallback to basic description
    return {
      description: `Manages ${featureName.toLowerCase()} functionality across ${files.length} files`,
      capabilities: ['Route handling and user interface', 'Backend service logic', 'Component rendering'],
      ai_generated: false,
      ai_error: error.message
    };
  }
}

// ============================================================================
// Helper Functions (from basic script)
// ============================================================================

function getTechStack() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(CONFIG.rootDir, 'package.json'), 'utf-8')
  );

  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const techStack = [];

  if (deps['react']) techStack.push(`React ${deps['react'].replace('^', '')}`);
  if (deps['@remix-run/react']) techStack.push(`Remix ${deps['@remix-run/react'].replace('^', '')}`);
  if (deps['vite']) techStack.push(`Vite ${deps['vite'].replace('^', '')}`);
  if (deps['typescript']) techStack.push('TypeScript');
  if (deps['@supabase/supabase-js']) techStack.push('Supabase (PostgreSQL + Auth + Storage)');
  if (deps['tailwindcss']) techStack.push(`Tailwind CSS ${deps['tailwindcss'].replace('^', '')}`);
  if (deps['class-variance-authority']) techStack.push('Shadcn/UI (Component library)');
  if (deps['stripe']) techStack.push('Stripe (Payment processing)');
  if (deps['@square/web-sdk'] || deps['square']) techStack.push('Square Web SDK (Payment processing)');
  if (deps['resend']) techStack.push('Resend (Email service)');
  if (deps['web-push']) techStack.push('Web Push (Push notifications)');
  if (deps['@google/generative-ai']) techStack.push('Google Gemini API (AI integration)');
  if (deps['zod']) techStack.push('Zod (Schema validation)');
  if (deps['react-hook-form']) techStack.push('React Hook Form');
  if (deps['@react-pdf/renderer']) techStack.push('@react-pdf/renderer (PDF generation)');
  if (deps['dinero.js']) techStack.push('dinero.js (Money calculations)');
  if (deps['vitest']) techStack.push('Vitest (Unit testing)');
  if (deps['@playwright/test']) techStack.push('Playwright (E2E testing)');
  if (deps['express']) techStack.push('Express (Production server)');
  if (deps['@sentry/remix']) techStack.push('Sentry (Error monitoring)');

  return techStack;
}

async function findFiles(patterns) {
  const allFiles = new Set();

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: CONFIG.rootDir,
      ignore: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/.cache/**']
    });
    files.forEach(f => allFiles.add(f));
  }

  return Array.from(allFiles).sort();
}

async function getAllRoutes() {
  const routes = await glob('app/routes/**/*.{ts,tsx}', { cwd: CONFIG.rootDir });

  return {
    total: routes.length,
    admin: routes.filter(r => r.includes('admin.')).length,
    family: routes.filter(r => r.includes('family.')).length,
    instructor: routes.filter(r => r.includes('instructor.')).length,
    api: routes.filter(r => r.includes('api.')).length,
    public: routes.filter(r => !r.includes('admin.') && !r.includes('family.') && !r.includes('instructor.') && !r.includes('api.')).length
  };
}

// ============================================================================
// Main Generation Function
// ============================================================================

async function generateCatalog() {
  console.log('🤖 AI-Enhanced Feature Catalog Generation\n');

  const aiEnabled = initializeAI();
  console.log('');

  const catalog = {
    meta: {
      type: 'AI-Enhanced Feature Catalog',
      generated_at: new Date().toISOString(),
      generated_by: 'scripts/generate-feature-catalog-ai.js',
      ai_model: aiEnabled ? CONFIG.aiModel : 'none',
      note: 'AI-generated descriptions. For manual overrides, see standard_prd.json'
    },

    stats: {
      routes: await getAllRoutes(),
      last_scan: new Date().toISOString()
    },

    tech_stack: getTechStack(),

    features: []
  };

  // Analyze each feature pattern
  for (const [featureName, patterns] of Object.entries(CONFIG.featurePatterns)) {
    console.log(`  Analyzing: ${featureName}`);

    const allPatterns = [
      ...(patterns.routePatterns || []),
      ...(patterns.servicePatterns || []),
      ...(patterns.componentPatterns || []),
      ...(patterns.utilPatterns || [])
    ];

    const files = await findFiles(allPatterns);

    if (files.length > 0) {
      const routes = files.filter(f => f.includes('/routes/'));
      const services = files.filter(f => f.includes('/services/'));
      const components = files.filter(f => f.includes('/components/'));
      const utils = files.filter(f => f.includes('/utils/'));

      // Get AI-enhanced description
      const aiAnalysis = await analyzeFeatureWithAI(featureName, files);

      const feature = {
        name: featureName,
        description: aiAnalysis.description,
        capabilities: aiAnalysis.capabilities,
        files: files,
        stats: {
          total: files.length,
          routes: routes.length,
          services: services.length,
          components: components.length,
          utils: utils.length
        },
        meta: {
          ai_generated: aiAnalysis.ai_generated,
          ...(aiAnalysis.ai_error && { ai_error: aiAnalysis.ai_error })
        }
      };

      catalog.features.push(feature);

      const statusIcon = aiAnalysis.ai_generated ? '🤖' : '📝';
      console.log(`    ${statusIcon} ${files.length} file(s) - ${aiAnalysis.description.substring(0, 60)}...`);
    } else {
      console.log(`    ⚠ No files found`);
    }

    // Small delay to avoid rate limiting
    if (aiEnabled) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Write output
  const outputPath = path.join(CONFIG.rootDir, CONFIG.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));

  console.log(`\n✅ Generated: ${CONFIG.output}`);
  console.log(`📊 Features detected: ${catalog.features.length}`);
  console.log(`🤖 AI-enhanced: ${catalog.features.filter(f => f.meta.ai_generated).length}`);
  console.log(`📁 Total routes: ${catalog.stats.routes.total}`);
  console.log(`🛠️  Tech stack items: ${catalog.tech_stack.length}`);
}

// ============================================================================
// Run
// ============================================================================

generateCatalog().catch(console.error);
