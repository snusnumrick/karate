import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Add type declaration for future flags
declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
    v3_throwAbortReason: true;
  }
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_singleFetch: true,  // Add this flag
        v3_throwAbortReason: true,
        v3_fetcherPersist: true,
        v3_lazyRouteDiscovery: true,
        v3_relativeSplatPath: true
      }
    }),
    tsconfigPaths(),
  ],
});
