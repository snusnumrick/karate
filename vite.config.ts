import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { setRemixDevLoadContext } from "@remix-run/dev/dist/vite/plugin";
import { deriveNonceForRequest, STRICT_DEV, DEV_FIXED_NONCE } from "./app/utils/nonce.server";

// Ensure loaders/actions receive a consistent nonce during Vite development
// Nonce generation is now handled by the shared utility

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
