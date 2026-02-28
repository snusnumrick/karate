import { describe, expect, it, vi } from 'vitest';
import { createPushStartup } from '../notification-startup';

describe('createPushStartup', () => {
  it('deduplicates concurrent startup and attaches listeners once', async () => {
    const initialize = vi.fn().mockResolvedValue(true);
    const setupMessageListener = vi.fn();
    const start = createPushStartup({ initialize, setupMessageListener });

    const [first, second] = await Promise.all([start(), start()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(setupMessageListener).toHaveBeenCalledTimes(1);

    const third = await start();
    expect(third).toBe(true);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(setupMessageListener).toHaveBeenCalledTimes(1);
  });

  it('does not attach listeners on failed initialization and retries later', async () => {
    const initialize = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const setupMessageListener = vi.fn();
    const start = createPushStartup({ initialize, setupMessageListener });

    const failed = await start();
    expect(failed).toBe(false);
    expect(setupMessageListener).not.toHaveBeenCalled();

    const succeeded = await start();
    expect(succeeded).toBe(true);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(setupMessageListener).toHaveBeenCalledTimes(1);
  });
});
