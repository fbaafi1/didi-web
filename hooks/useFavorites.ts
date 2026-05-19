import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

const STORAGE_KEY = '@didi_favorites';

interface FavoritesState {
  favoriteIds: Set<string>;
  loaded: boolean;
  _setIds: (ids: Set<string>) => void;
}

const useFavoritesStore = create<FavoritesState>((set) => ({
  favoriteIds: new Set<string>(),
  loaded: false,
  _setIds: (ids) => set({ favoriteIds: ids, loaded: true }),
}));

// Load from localStorage once
let _loadPromise: Promise<void> | null = null;
function ensureLoaded() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        useFavoritesStore.getState()._setIds(new Set(parsed));
      } else {
        useFavoritesStore.getState()._setIds(new Set());
      }
    } catch {
      useFavoritesStore.getState()._setIds(new Set());
    }
  })();
  return _loadPromise;
}

/**
 * Local-only favorites stored in localStorage.
 * Web replacement for the AsyncStorage-based hook.
 * Uses Zustand so state is shared across all components instantly.
 */
export function useFavorites() {
  const { favoriteIds, loaded } = useFavoritesStore();

  useEffect(() => { ensureLoaded(); }, []);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const next = new Set(favoriteIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      useFavoritesStore.getState()._setIds(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
    },
    [favoriteIds],
  );

  const favoriteCount = favoriteIds.size;
  return { isFavorite, toggleFavorite, favoriteIds, favoriteCount, loaded };
}
