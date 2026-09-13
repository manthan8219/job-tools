/**
 * Executes an array of items through an async mapping function with a concurrency limit.
 * Similar to p-limit or Go worker pool with semaphores, ensuring we don't overwhelm network resources.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err) {
        // Individual error handled or captured in caller
        throw err;
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Runs items concurrently but collects successes and catches errors individually (Settled mode).
 */
export async function runWithConcurrencySettled<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 5
): Promise<Array<{ status: "fulfilled"; value: R } | { status: "rejected"; reason: any }>> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: Array<{ status: "fulfilled"; value: R } | { status: "rejected"; reason: any }> = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        const val = await fn(items[idx], idx);
        results[idx] = { status: "fulfilled", value: val };
      } catch (err) {
        results[idx] = { status: "rejected", reason: err };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
