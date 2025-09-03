import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import crypto from "node:crypto";
import { setRemixDevLoadContext } from "@remix-run/dev/dist/vite/plugin";

// Ensure loaders/actions receive a consistent nonce during Vite development
// In strict dev CSP, use a fixed dev nonce to avoid SSR/CSR mismatches
const STRICT_DEV = process.env.CSP_STRICT_DEV === '1' || process.env.CSP_STRICT_DEV === 'true';
const DEV_FIXED_NONCE = 'dev-fixed-nonce';

// Per-process secret to derive deterministic nonces per request (same within a single invocation)
const NONCE_SECRET = crypto.randomBytes(32);

function deriveNonceForRequest(request: Request) {
    if (STRICT_DEV) return DEV_FIXED_NONCE;
    const ua = request.headers.get('user-agent') || '';
    const al = request.headers.get('accept-language') || '';
    const xfwdHost = request.headers.get('x-forwarded-host') || '';
    const xfwdProto = request.headers.get('x-forwarded-proto') || '';
    const data = `${request.url}|${ua}|${al}|${xfwdHost}|${xfwdProto}`;
    const digest = crypto.createHmac('sha256', NONCE_SECRET).update(data).digest('base64');
    // Keep nonce reasonably short while remaining high entropy
    return digest.slice(0, 22); // ~132 bits of entropy
}

setRemixDevLoadContext((request) => ({
  nonce: deriveNonceForRequest(request),
}));

// Add type declaration for future flags
declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
    v3_throwAbortReason: true;
  }
}

export default defineConfig({
  html: {
    // Let Vite add nonce to its injected <script>, <style> and <link> tags
    cspNonce: STRICT_DEV ? DEV_FIXED_NONCE : undefined,
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@remix-run/react",
      "lucide-react",
      "@radix-ui/react-slot",
      "@radix-ui/react-toast",
      "@radix-ui/react-dropdown-menu",
      "class-variance-authority",
      "clsx",
      "tailwind-merge"
    ]
  },
  server: {
    port: 5176,
    hmr: {
      port: 5177,
      host: 'localhost'
    }
  }
});
