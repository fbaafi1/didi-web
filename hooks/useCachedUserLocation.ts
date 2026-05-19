import { useEffect, useState } from 'react';
import { cacheGet, cacheSet, cacheRemove } from '@/utils/cache';
import type { LatLng } from '@/utils/geo';

const STORAGE_KEY = 'didi:last_known_location_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedPayload = { latitude: number; longitude: number; savedAt: number };

/**
 * Cached GPS position (5 min TTL) using browser navigator.geolocation.
 * Web replacement for the expo-location hook.
 * Falls back to popularity ordering when permission is denied.
 */
export function useCachedUserLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setResolved(true);
      return;
    }

    let cancelled = false;

    // Try cached coords first
    const cached = cacheGet<CachedPayload>(STORAGE_KEY);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
      if (!cancelled) {
        setCoords({ latitude: cached.latitude, longitude: cached.longitude });
        setResolved(true);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const next: LatLng = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(next);
        cacheSet<CachedPayload>(STORAGE_KEY, {
          latitude: next.latitude,
          longitude: next.longitude,
          savedAt: Date.now(),
        });
        setResolved(true);
      },
      () => {
        if (cancelled) return;
        cacheRemove(STORAGE_KEY);
        setPermissionDenied(true);
        setResolved(true);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: CACHE_TTL_MS },
    );

    return () => { cancelled = true; };
  }, []);

  const useProximity = coords != null && !permissionDenied;
  return { coords, permissionDenied, resolved, useProximity };
}
