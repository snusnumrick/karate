/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  future: {
    v3_fetcherPersist: true,
    // v3_lazyRouteDiscovery: true, // Temporarily disable for testing outlet issue
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
  // ... existing config
};
