/**
 * Lightweight localStorage cache for offline-resilient data loading.
 * Web replacement for the AsyncStorage cache in the Expo app.
 * Pattern: show cached data instantly → refresh from network in background.
 */

const PREFIX = 'didi_cache:';

/** Read a cached value (returns null if missing or corrupt). */
export function cacheGet<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write a value to cache (silently fails — cache is best-effort). */
export function cacheSet<T>(key: string, data: T): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // Best-effort — silently ignore write failures
  }
}

/** Remove a cached value. */
export function cacheRemove(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore
  }
}
