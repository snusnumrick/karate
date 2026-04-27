import { describe, expect, it } from "vitest";
import { isChunkLoadError, shouldAttemptChunkReload } from "~/utils/chunk-recovery";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("chunk recovery helpers", () => {
  it("detects common chunk-loading error signatures", () => {
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 234 failed."))).toBe(true);
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
    expect(isChunkLoadError({ message: "Importing a module script failed." })).toBe(true);
    expect(isChunkLoadError("Error loading route module `/assets/admin.programs.new-BS8rnqT7.js`, reloading page...")).toBe(true);
  });

  it("ignores non-chunk errors", () => {
    expect(isChunkLoadError(new Error("Network timeout"))).toBe(false);
    expect(isChunkLoadError({ message: "Validation failed" })).toBe(false);
  });

  it("only allows one automatic reload per URL", () => {
    const storage = createMemoryStorage();

    expect(shouldAttemptChunkReload(storage, "https://example.com/pay/1")).toBe(true);
    expect(shouldAttemptChunkReload(storage, "https://example.com/pay/1")).toBe(false);
    expect(shouldAttemptChunkReload(storage, "https://example.com/pay/2")).toBe(true);
  });
});
