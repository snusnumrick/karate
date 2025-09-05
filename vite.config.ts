import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { deriveNonceForRequest } from "./app/utils/nonce.server";
import { vercelPreset } from "@vercel/remix/vite";
import type { Plugin } from "vite";

// @ts-ignore
import { setRemixDevLoadContext } from "@remix-run/dev/dist/vite/plugin";

// Only set dev load context in development mode
// In production (Vercel), this is handled by the server adapter
if (process.env.NODE_ENV === 'development') {
  try {
    setRemixDevLoadContext(() => ({
      nonce: deriveNonceForRequest(),
    }));
  } catch (error: unknown) {
    console.warn('Could not set dev load context:', error instanceof Error ? error.message : String(error));
  }
}

// Custom plugin to enhance CSP nonce handling for Vite's injected styles
function cspNoncePlugin(): Plugin {
  return {
    name: 'csp-nonce-plugin',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.server) {
          // Ensure the meta tag for CSP nonce is present for Vite to read
          if (!html.includes('name="csp-nonce"')) {
            const metaTag = `<meta name="csp-nonce" content="dev-vite-nonce" />`;
            html = html.replace('<head>', `<head>\n    ${metaTag}`);
          }
        }
        return html;
      },
    },
  };
}

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
    // Always use nonce in development to prevent CSP violations
    cspNonce: process.env.NODE_ENV === 'development' ? 'dev-vite-nonce' : undefined,
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
      presets: [vercelPreset()],
    }),
    tsconfigPaths(),
    cspNoncePlugin(),
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
