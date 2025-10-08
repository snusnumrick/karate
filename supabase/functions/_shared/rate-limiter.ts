/**
 * Rate Limiter Utility
 *
 * Ensures a minimum delay between operations to respect API rate limits.
 * Resend has a limit of 2 requests per second, so we default to 500ms delay.
 */

export class RateLimiter {
  private lastExecutionTime: number = 0;
  private readonly delayMs: number;

  /**
   * @param delayMs - Minimum delay between operations in milliseconds (default: 500ms)
   */
  constructor(delayMs: number = 500) {
    this.delayMs = delayMs;
  }

  /**
   * Execute a function with rate limiting
   * @param fn - The async function to execute
   * @returns The result of the function
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;

    if (timeSinceLastExecution < this.delayMs) {
      const waitTime = this.delayMs - timeSinceLastExecution;
      console.log(`Rate limiter: waiting ${waitTime}ms before next operation`);
      await this.sleep(waitTime);
    }

    this.lastExecutionTime = Date.now();
    return await fn();
  }

  /**
   * Process an array of items with rate limiting
   * @param items - Array of items to process
   * @param processFn - Async function to process each item
   * @returns Array of results
   */
  async processArray<T, R>(
    items: T[],
    processFn: (item: T, index: number) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i++) {
      const result = await this.execute(() => processFn(items[i], i));
      results.push(result);
    }

    return results;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
