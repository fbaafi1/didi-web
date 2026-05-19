/**
 * Haversine distance and vendor listing helpers for proximity sorting.
 * Identical to the Expo app — pure TypeScript, no RN dependencies.
 */

export const NEARBY_RADIUS_KM = 10;

export type LatLng = { latitude: number; longitude: number };

/** Great-circle distance between two WGS84 points in kilometers. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = deg2rad(b.latitude - a.latitude);
  const dLon = deg2rad(b.longitude - a.longitude);
  const lat1 = deg2rad(a.latitude);
  const lat2 = deg2rad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

export function isWithinNearbyRadius(km: number, maxKm: number = NEARBY_RADIUS_KM): boolean {
  return Number.isFinite(km) && km >= 0 && km <= maxKm;
}

type RestaurantSortFields = {
  id: string;
  name: string;
  rating: number;
  rating_count: number;
  latitude?: number | null;
  longitude?: number | null;
};

export type FoodItemForSort = {
  id: string;
  name: string;
  restaurant: RestaurantSortFields;
};

function comparePopularRestaurants(a: RestaurantSortFields, b: RestaurantSortFields): number {
  const c = (b.rating_count ?? 0) - (a.rating_count ?? 0);
  if (c !== 0) return c;
  const r = (b.rating ?? 0) - (a.rating ?? 0);
  if (r !== 0) return r;
  return (a.name ?? '').localeCompare(b.name ?? '');
}

function compareItemsPopular(a: FoodItemForSort, b: FoodItemForSort): number {
  const cr = comparePopularRestaurants(a.restaurant, b.restaurant);
  if (cr !== 0) return cr;
  return (a.name ?? '').localeCompare(b.name ?? '');
}

/** Fisher-Yates in-place shuffle. */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleWithinGroups<T>(sorted: T[], key: (item: T) => string | number): T[] {
  if (sorted.length === 0) return [];
  const result: T[] = [];
  let i = 0;
  while (i < sorted.length) {
    const k = key(sorted[i]);
    let j = i + 1;
    while (j < sorted.length && key(sorted[j]) === k) j++;
    result.push(...shuffleInPlace(sorted.slice(i, j)));
    i = j;
  }
  return result;
}

function vendorCoords(r: RestaurantSortFields): LatLng | null {
  const lat = r.latitude;
  const lng = r.longitude;
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

export function sortFoodItemsByVendorDistance<T extends FoodItemForSort>(
  items: T[],
  user: LatLng | null
): T[] {
  if (items.length === 0) return [];

  if (!user) {
    const popularSorted = [...items]
      .sort(compareItemsPopular)
      .map((item) => enrichRestaurant(item, null));
    return shuffleWithinGroups(
      popularSorted,
      (item) => (item as any).restaurant.rating_count ?? 0,
    );
  }

  const distByRestaurant = new Map<string, number | null>();

  const getDist = (rid: string, r: RestaurantSortFields): number | null => {
    if (distByRestaurant.has(rid)) return distByRestaurant.get(rid)!;
    const vc = vendorCoords(r);
    let d: number | null = null;
    if (vc) d = haversineKm(user, vc);
    distByRestaurant.set(rid, d);
    return d;
  };

  const sorted = [...items].sort((a, b) => {
    const da = getDist(a.restaurant.id, a.restaurant);
    const db = getDist(b.restaurant.id, b.restaurant);
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    return compareItemsPopular(a, b);
  });

  const enriched = sorted.map((item) => {
    const km = distByRestaurant.get(item.restaurant.id);
    return enrichRestaurant(item, km ?? null);
  });

  return shuffleWithinGroups(
    enriched,
    (item) => {
      const km = (item as any).restaurant.distanceKm;
      return km != null && Number.isFinite(km) ? Math.floor(km) : 'no-coords';
    },
  );
}

function enrichRestaurant<T extends FoodItemForSort>(item: T, distanceKm: number | null): T {
  const isNearby = distanceKm != null && isWithinNearbyRadius(distanceKm);
  return {
    ...item,
    restaurant: {
      ...item.restaurant,
      distanceKm: distanceKm ?? undefined,
      isNearby,
    },
  } as T;
}
