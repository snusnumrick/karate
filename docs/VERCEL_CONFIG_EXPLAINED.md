# Vercel Configuration Explained

This document explains each section of the `vercel.json` configuration file and how it helps with CSP nonce handling in our Vercel deployment.

## Configuration Breakdown

### Build Configuration
```json
"buildCommand": "npm run build",
"devCommand": "npm run dev",
"installCommand": "npm install"
```

**Purpose**: Ensures proper server-side rendering setup for nonce generation
- Defines the exact build process that includes server-side rendering setup
- Critical for nonce generation to work correctly in production
- Ensures consistent build behavior across environments

### Framework Override
```json
"framework": null
```

**Purpose**: Disables automatic framework detection to prevent interference with custom nonce handling
- Prevents Vercel from applying automatic optimizations that might interfere with our custom nonce logic
- Ensures our manual configuration takes precedence
- Maintains control over the deployment process

### Function Configuration
```json
"functions": {
  "build/server/index.js": {
    "maxDuration": 60
  }
}
```

**Purpose**: Critical for nonce processing - extends timeout to prevent failures
- **Extended timeout to 60 seconds** - prevents timeouts during CSP nonce generation
- **Default Vercel timeout (10s)** was too short for server-side nonce processing
- Without this, nonce generation could fail silently, causing CSP violations
- Ensures sufficient time for:
  - Nonce derivation from request headers
  - CSP header construction
  - Server-side rendering with nonce injection

### Routing Configuration
```json
"routes": [
  {
    "src": "/build/client/(.*)",
    "headers": {
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  },
  {
    "handle": "filesystem"
  },
  {
    "src": "/(.*)",
    "dest": "/build/server/index.js"
  }
]
```

#### Static Client Assets Route
```json
{
  "src": "/build/client/(.*)",
  "headers": {
    "Cache-Control": "public, max-age=31536000, immutable"
  }
}
```
**Purpose**: Optimizes static content delivery
- Static client assets get optimized caching headers
- Separates static content from dynamic server-rendered content that needs nonces
- Improves performance by caching static assets for 1 year

#### Filesystem Handler
```json
{
  "handle": "filesystem"
}
```
**Purpose**: Handles static file requests
- Serves static files directly from the filesystem
- Bypasses server function for static content
- Improves performance for assets that don't need nonce processing

#### Server Function Route
```json
{
  "src": "/(.*)",
  "dest": "/build/server/index.js"
}
```
**Purpose**: **Most critical for nonce handling**
- **All other requests route to server function where nonces are generated**
- **This ensures every request goes through the nonce generation logic in `entry.server.tsx`**
- **Critical for CSP header generation and preventing nonce violations**
- Without this route, requests might bypass nonce generation entirely

## How This Solves the Nonce Problem

### The Original Issue
Before this configuration:
- Vercel's default serverless function timeout was too short (10s)
- Requests weren't consistently routed through the server-side nonce logic
- The `setRemixDevLoadContext` in Vite config didn't work in Vercel's production environment
- CSP nonce violations occurred because nonces weren't being generated properly

### The Solution
With this `vercel.json` configuration:
1. **Guaranteed Server Routing**: Every dynamic request goes through the server function
2. **Sufficient Processing Time**: 60-second timeout allows for nonce processing
3. **Proper Asset Separation**: Static assets are cached, dynamic content gets nonces
4. **Framework Control**: Manual configuration prevents automatic optimizations that could break nonce handling

### Integration with Other Components
This configuration works together with:
- **`entry.server.tsx`**: Where nonces are generated and CSP headers are set
- **`root.tsx`**: Where nonce fallback logic ensures nonces are always available
- **`vite.config.ts`**: Development-only nonce context setup
- **`app/utils/nonce.server.ts`**: Core nonce generation utilities

## Testing the Configuration

To verify this configuration is working:
1. Deploy to Vercel
2. Check browser dev tools for CSP headers with nonces
3. Verify no CSP violations in console
4. Confirm server function doesn't timeout (should complete within 60s)

## Troubleshooting

If you encounter issues:
- **Timeout errors**: Increase `maxDuration` beyond 60 seconds
- **Missing nonces**: Verify the catch-all route `"src": "/(.*)"`
- **Static asset issues**: Check the client asset route pattern
- **Build failures**: Verify build commands match your package.json scripts