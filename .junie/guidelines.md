# Karate Management System - Development Guidelines

## Project Overview
This is a Remix.js application for managing a karate school, built with TypeScript, Tailwind CSS, and Supabase as the backend. The application handles student enrollment, payments, class scheduling, and family management.

## Project Structure
```
app/
├── components/     # Reusable React components
├── config/         # Configuration files
├── db/            # Database utilities
├── hooks/         # Custom React hooks
├── lib/           # Utility libraries
├── routes/        # Remix route components (file-based routing)
├── services/      # Business logic and API services
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
├── entry.client.tsx
├── entry.server.tsx
├── root.tsx       # Root application component
└── tailwind.css   # Tailwind CSS styles

supabase/
├── functions/     # Supabase Edge Functions (Deno)
└── migrations/    # Database migration files

Other important directories:
├── public/        # Static assets
├── build/         # Build output (generated)
└── .junie/        # Junie-specific files
```

## Build & Configuration Instructions

### Prerequisites
- Node.js version 22+ (specified in package.json engines)
- npm or equivalent package manager

### Development Setup
1. Install dependencies: `npm install`
2. Set up environment variables (copy `.env.example` to `.env`)
3. Start development server: `npm run dev`
4. Access the application at `http://localhost:5173` (Vite default)

### Build Process
- **Development build**: `npm run dev`
- **Production build**: `npm run build` (runs `vite build && vite build --ssr`)
- **Start production server**: `npm start`
- **Type checking**: `npm run typecheck`
- **Linting**: `npm run lint`

### Important Configuration Files
- `vite.config.ts`: Vite configuration with Remix and Vercel preset
- `remix.config.js`: Remix-specific configuration with future flags
- `tsconfig.json`: TypeScript configuration with path mapping (`~/*` → `./app/*`)
- `.eslintrc.cjs`: ESLint configuration for React/TypeScript
- `tailwind.config.ts`: Tailwind CSS configuration

## Testing Information

### Current Testing Status
⚠️ **No formal testing framework is currently configured** in the project, though there are remnants of previous Playwright usage (playwright-report directory exists).

### Recommended Testing Approach
For new tests, use Node.js built-in test runner (available in Node 18+):

#### Running Tests
```bash
# Run a single test file
node test-filename.js

# Run all test files (if you create a test script)
node --test **/*.test.js
```

#### Creating Tests
Create test files with `.test.js` or `.spec.js` extensions. Example structure:
```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Feature Name', () => {
  test('should do something', () => {
    // Test implementation
    assert.strictEqual(actual, expected);
  });
});
```

#### Testing Guidelines
- Place test files alongside the code they test or in a `__tests__` directory
- Use descriptive test names that explain the expected behavior
- Test both happy path and error conditions
- For React components, consider using @testing-library/react
- For API routes, test both success and error responses

### Adding Formal Testing Framework
If you need more advanced testing features, consider adding:
- **Vitest**: For unit/integration tests (works well with Vite)
- **Playwright**: For end-to-end testing (evidence suggests it was used before)
- **@testing-library/react**: For React component testing

## Code Style & Development Standards

### TypeScript Configuration
- Strict mode enabled
- Path mapping: Use `~/` prefix for imports from the app directory
- Target: ES2022
- Module resolution: Bundler (Vite)

### ESLint Rules
- React recommended rules with JSX runtime
- TypeScript recommended rules
- Import/export linting
- Accessibility (jsx-a11y) rules
- React hooks rules

### Code Style Guidelines
1. **File Naming**: Use kebab-case for files, PascalCase for React components
2. **Import Organization**: 
   - External libraries first
   - Internal imports using `~/` path mapping
   - Relative imports last
3. **Component Structure**: Follow Remix conventions for route components
4. **Type Safety**: Leverage TypeScript strictly, avoid `any` types
5. **Accessibility**: Follow jsx-a11y recommendations

### Database & Supabase
- Database migrations in `supabase/migrations/`
- Edge Functions in `supabase/functions/` (Deno runtime)
- Use TypeScript for type safety with Supabase client

## Development Workflow Recommendations

### Before Submitting Changes
1. **Type Check**: Run `npm run typecheck` to ensure no TypeScript errors
2. **Lint**: Run `npm run lint` to check code style
3. **Build**: Run `npm run build` to ensure the application builds successfully
4. **Test**: Run any relevant tests you've created

### Environment Variables
- Copy `.env.example` to `.env` for local development
- Never commit actual `.env` files
- Use Vercel dashboard for production environment variables

### Deployment
- The project is configured for Vercel deployment
- Automatic deployments from main branch
- Preview deployments for pull requests

## Special Considerations

### Remix Future Flags
The project uses several Remix v3 future flags:
- `v3_singleFetch`: Enabled for improved data loading
- `v3_throwAbortReason`: Better error handling
- `v3_fetcherPersist`: Improved form handling
- `v3_lazyRouteDiscovery`: Lazy route loading
- `v3_relativeSplatPath`: Better route matching

### Supabase Integration
- Database operations through Supabase client
- Real-time subscriptions for live updates
- Row Level Security (RLS) policies for data protection
- Edge Functions for server-side logic

### Performance Considerations
- Use Remix's built-in optimizations (prefetching, etc.)
- Leverage Supabase's built-in caching
- Optimize images in the `public/` directory
- Consider code splitting for large components
