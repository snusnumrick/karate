/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

declare global {
  interface Window {
    __REMIX_DEV_TOOLS?: {
      suppressHydrationWarning: boolean;
      suppressExtraHydrationErrors: boolean;
    };
  }
}

import {RemixBrowser} from "@remix-run/react";
import {startTransition, StrictMode} from "react";
import {hydrateRoot} from "react-dom/client";

if (process.env.NODE_ENV === 'development') {
    window.__REMIX_DEV_TOOLS = {
        suppressHydrationWarning: true,
        suppressExtraHydrationErrors: true
    };
}

startTransition(() => {
    hydrateRoot(
        document,
        <StrictMode>
            <RemixBrowser/>
        </StrictMode>
    );
});
