export interface PushStartupAdapter {
  initialize: () => Promise<boolean>;
  setupMessageListener: () => void;
}

/**
 * Build an idempotent startup function for push notifications.
 * It deduplicates concurrent calls and only attaches listeners after successful initialization.
 */
export function createPushStartup(adapter: PushStartupAdapter): () => Promise<boolean> {
  let started = false;
  let pending: Promise<boolean> | null = null;

  return async () => {
    if (started) {
      return true;
    }

    if (!pending) {
      pending = (async () => {
        const initialized = await adapter.initialize();
        if (initialized) {
          adapter.setupMessageListener();
          started = true;
        }
        return initialized;
      })().finally(() => {
        pending = null;
      });
    }

    return pending;
  };
}
