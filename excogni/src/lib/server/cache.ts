/**
 * Minimal in-memory TTL cache for expensive PUBLIC aggregate queries (v0.67.1).
 * The /statistics page is unauthenticated and runs several percentile scans over the
 * whole consented pool - a traffic spike would multiply identical heavy queries against
 * Postgres. Sixty seconds of staleness on population medians is invisible; the database
 * protection is not.
 *
 * Concurrent callers for the same key share ONE in-flight promise (stampede guard), so a
 * burst of first requests still produces a single query. Errors are never cached. Only
 * suppression-gated public aggregates go through this - never per-user data.
 */
type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_KEYS = 500; // bounded: distinct explore slices are finite, but belt-and-suspenders

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const p = fn()
    .then((value) => {
      if (store.size >= MAX_KEYS) {
        // drop expired first; if none, drop the oldest insertion
        for (const [k, e] of store) if (e.expires <= Date.now()) store.delete(k);
        if (store.size >= MAX_KEYS) store.delete(store.keys().next().value as string);
      }
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Test hook. */
export function _clearCache(): void {
  store.clear();
  inflight.clear();
}
