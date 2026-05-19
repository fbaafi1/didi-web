'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Heart, Clock, MapPin, User } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { PLATFORM, CATEGORY_ICONS, FOOD_CATEGORIES } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { useCachedUserLocation } from '@/hooks/useCachedUserLocation';
import { sortFoodItemsByVendorDistance, formatDistanceKm } from '@/utils/geo';
import { getRestaurantStatus } from '@/utils/openingHours';
import { useFavorites } from '@/hooks/useFavorites';
import { cacheGet, cacheSet } from '@/utils/cache';
import styles from './marketplace.module.css';

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

interface Ad {
  id: string;
  title: string | null;
  video_url: string | null;
  image_urls: string[];
  link_url: string | null;
}

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string | null;
  restaurant: {
    id: string; name: string; address: string | null; city: string;
    food_category: string; logo_url: string | null; is_open: boolean;
    opening_hours: string | null; phone: string;
    rating: number; rating_count: number;
    latitude?: number | null; longitude?: number | null;
    distanceKm?: number; isNearby?: boolean;
  };
}

interface SearchSuggestion {
  label: string;
  type: 'item' | 'restaurant' | 'city' | 'address';
  itemId?: string;
  restaurantId?: string;
}

export default function MarketplacePage() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { coords, useProximity } = useCachedUserLocation();
  const { isFavorite, toggleFavorite, favoriteIds, favoriteCount } = useFavorites();

  const [items, setItems] = useState<FoodItem[]>([]);
  const [filtered, setFiltered] = useState<FoodItem[]>([]);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [appliedSuggestion, setAppliedSuggestion] = useState<SearchSuggestion | null>(null);
  const [category, setCategory] = useState('All');
  const [filterCategories, setFilterCategories] = useState<string[]>(['All', '❤️ Favorites', ...FOOD_CATEGORIES]);
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<Ad[]>([]);

  const attachLiveRatings = async (rawItems: FoodItem[]): Promise<FoodItem[]> => {
    if (!rawItems.length) return rawItems;
    const rIds = [...new Set(rawItems.map(i => i.restaurant.id))];
    const { data } = await supabase
      .from('item_reviews')
      .select('rating, item:menu_items!inner(restaurant_id)')
      .eq('status', 'approved')
      .in('item.restaurant_id', rIds);
    const stats = new Map<string, { sum: number; count: number }>();
    (data ?? []).forEach((row: any) => {
      const rid = row?.item?.restaurant_id as string | undefined;
      const r = Number(row?.rating);
      if (!rid || !Number.isFinite(r)) return;
      const p = stats.get(rid) ?? { sum: 0, count: 0 };
      stats.set(rid, { sum: p.sum + r, count: p.count + 1 });
    });
    return rawItems.map(item => {
      const s = stats.get(item.restaurant.id);
      const count = s?.count ?? 0;
      return { ...item, restaurant: { ...item.restaurant, rating: count > 0 ? +(s!.sum / count).toFixed(1) : 0, rating_count: count } };
    });
  };

  const fetchItems = async () => {
    const cached = cacheGet<FoodItem[]>('marketplace_items');
    if (cached?.length) {
      const withRatings = await attachLiveRatings(cached).catch(() => cached);
      setItems(withRatings); setFiltered(withRatings); setLoading(false);
    }
    try {
      const q = `id, name, description, price, image_url, is_available, category_id,
        restaurant:restaurants!inner(id, name, address, city, food_category, logo_url, is_open,
        opening_hours, phone, rating, rating_count, is_approved, subscription_expires_at, latitude, longitude)`;
      let { data } = await supabase.from('menu_items').select(q)
        .eq('is_available', true).eq('restaurant.is_approved', true)
        .gte('restaurant.subscription_expires_at', new Date().toISOString());
      if (!data?.length) {
        const { data: fb } = await supabase.from('menu_items').select(q)
          .eq('is_available', true).eq('restaurant.is_approved', true);
        data = fb;
      }
      if (data?.length) {
        const withRatings = await attachLiveRatings(data as unknown as FoodItem[]);
        setItems(withRatings); setFiltered(withRatings); cacheSet('marketplace_items', withRatings);
      } else if (!cached?.length) { setItems([]); setFiltered([]); }
    } catch { /* keep cache */ }
    setLoading(false);
  };

  const fetchAds = useCallback(async () => {
    const cached = cacheGet<Ad[]>('ads');
    if (cached?.length) setAds(cached);
    try {
      const now = new Date().toISOString();
      let { data, error } = await supabase.from('ads')
        .select('id, title, video_url, image_urls, link_url')
        .eq('is_active', true).lte('starts_at', now).gte('expires_at', now);
      let adsData = (data as Ad[] | null) ?? [];
      if (error || !adsData.length) {
        const { data: ld } = await supabase.from('ads')
          .select('id, title, media_url, media_type, link_url')
          .eq('is_active', true).lte('starts_at', now).gte('expires_at', now);
        adsData = ((ld ?? []) as any[]).map(a => ({
          id: a.id, title: a.title ?? null,
          video_url: a.media_type === 'video' ? a.media_url : null,
          image_urls: a.media_type === 'image' && a.media_url ? [a.media_url] : [],
          link_url: a.link_url ?? null,
        }));
      }
      if (adsData.length) {
        setAds(shuffleArray(adsData));
        cacheSet('ads', adsData);
      }
    } catch { /* keep cache */ }
  }, []);

  // Shuffle categories only on the client after hydration to avoid SSR mismatch
  useEffect(() => {
    setFilterCategories(['All', '❤️ Favorites', ...shuffleArray([...FOOD_CATEGORIES])]);
  }, []);

  useEffect(() => { fetchItems(); fetchAds(); }, []);

  const userPos = useProximity && coords ? coords : null;
  const sortedItems = useMemo(() => sortFoodItemsByVendorDistance(items, userPos), [items, userPos]);

  useEffect(() => {
    let result = sortedItems;
    if (category === '❤️ Favorites') result = result.filter(i => favoriteIds.has(i.id));
    else if (category !== 'All') result = result.filter(i => i.restaurant.food_category === category);
    if (appliedSuggestion) {
      const q = appliedSuggestion.label.toLowerCase();
      result = result.filter(i => {
        if (appliedSuggestion.type === 'item') return i.id === appliedSuggestion.itemId;
        if (appliedSuggestion.type === 'restaurant') return i.restaurant.id === appliedSuggestion.restaurantId;
        if (appliedSuggestion.type === 'city') return i.restaurant.city.toLowerCase().includes(q);
        return (i.restaurant.address ?? '').toLowerCase().includes(q);
      });
    }
    setFiltered(result);
  }, [category, sortedItems, appliedSuggestion, favoriteIds]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setSuggestions([]); if (appliedSuggestion) setAppliedSuggestion(null); return; }
    const unique = new Map<string, SearchSuggestion>();
    const tryAdd = (label: string | null | undefined, type: SearchSuggestion['type'], meta?: Pick<SearchSuggestion, 'itemId' | 'restaurantId'>) => {
      const v = (label ?? '').trim();
      if (!v || !v.toLowerCase().includes(q)) return;
      const key = `${type}:${v.toLowerCase()}:${meta?.itemId ?? ''}:${meta?.restaurantId ?? ''}`;
      if (!unique.has(key)) unique.set(key, { label: v, type, ...meta });
    };
    items.forEach(item => {
      tryAdd(item.name, 'item', { itemId: item.id });
      tryAdd(item.restaurant.name, 'restaurant', { restaurantId: item.restaurant.id });
      tryAdd(item.restaurant.city, 'city');
      tryAdd(item.restaurant.address, 'address');
    });
    const matches = shuffleArray([...unique.values()]);
    setSuggestions(matches.slice(0, 8));
  }, [search, items]);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLogo}>
          <div className={styles.logoBadge}><span className={styles.logoText}>DiDi</span></div>
          <span className={styles.brandName}>{PLATFORM.name}</span>
        </div>
        {!session && (
          <Link href="/auth/login" className={styles.signInBtn} id="btn-header-signin">
            <User size={16} />
            Sign In
          </Link>
        )}
      </div>

      {/* Search bar */}
      <div className={styles.searchArea}>
        <div className={styles.searchWrap}>
          <Search size={18} color="var(--color-text-muted)" />
          <input
            id="search-input"
            className={styles.searchInput}
            placeholder="Search food, restaurant, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search.length > 0 && (
            <button className={styles.clearBtn} onClick={() => { setSearch(''); setAppliedSuggestion(null); }} aria-label="Clear search">
              <X size={18} color="var(--color-text-muted)" />
            </button>
          )}
        </div>

        {search.trim().length > 0 && suggestions.length > 0 && (
          <div className={styles.suggestions}>
            {suggestions.map((s, i) => (
              <button
                key={`${s.type}-${s.label}-${i}`}
                className={styles.suggestionRow}
                onClick={() => {
                  setSearch(s.label);
                  setAppliedSuggestion(s);
                  setSuggestions([]);
                  if (s.type === 'item' && s.itemId) router.push(`/customer/item/${s.itemId}`);
                  else if (s.type === 'restaurant' && s.restaurantId) router.push(`/customer/restaurant/${s.restaurantId}`);
                }}
              >
                <span className={styles.suggestionIcon}>
                  {s.type === 'item' ? '🍽️' : s.type === 'restaurant' ? '🏪' : '📍'}
                </span>
                <span className={styles.suggestionLabel}>{s.label}</span>
                <span className={styles.suggestionType}>{s.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category chips */}
      <div className={styles.catScrollWrap}>
        <div className={styles.catScroll}>
          {filterCategories.map(c => (
            <button
              key={c}
              className={`${styles.catChip}${category === c ? ` ${styles.catChipActive}` : ''}${c === '❤️ Favorites' && category === c ? ` ${styles.favChipActive}` : ''}`}
              onClick={() => setCategory(c)}
            >
              {c === '❤️ Favorites' ? (
                <>
                  <Heart size={14} fill={category === c ? '#fff' : 'none'} color={category === c ? '#fff' : '#FF6B8A'} />
                  <span>Favorites</span>
                  {favoriteCount > 0 && (
                    <span className={`${styles.favBadge}${category === c ? ` ${styles.favBadgeActive}` : ''}`}>{favoriteCount}</span>
                  )}
                </>
              ) : (
                <>
                  {c !== 'All' && <span>{CATEGORY_ICONS[c] ?? '🍽️'}</span>}
                  <span>{c}</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="page-loader"><span className="spinner spinner--primary" /></div>
      ) : (
        <div className={styles.listArea}>
          {ads.length > 0 && <AdBoard ads={ads} />}
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span style={{ fontSize: 48 }}>🍽️</span>
              <p className={styles.emptyTitle}>No food items found</p>
              <p className={styles.emptySub}>Try a different search or category</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(food => (
                <FoodCard
                  key={food.id}
                  food={food}
                  isFav={isFavorite(food.id)}
                  onToggleFav={() => toggleFavorite(food.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ad Board ────────────────────────────────────────────────────────────────
function AdBoard({ ads }: { ads: Ad[] }) {
  const [adIdx, setAdIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentAd = ads[adIdx];
  const images = currentAd?.image_urls ?? [];

  const goNext = useCallback(() => {
    setAdIdx(prev => (prev + 1) % ads.length);
    setImgIdx(0);
  }, [ads.length]);

  // Auto-slide images every 3s
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setImgIdx(prev => (prev + 1) % images.length), 3000);
    return () => clearInterval(t);
  }, [adIdx, images.length]);

  // Reset image index on ad change
  useEffect(() => { setImgIdx(0); }, [adIdx]);

  if (!currentAd) return null;

  return (
    <div
      className={styles.adBoard}
      onClick={() => { if (currentAd.link_url) window.open(currentAd.link_url, '_blank'); }}
      style={{ cursor: currentAd.link_url ? 'pointer' : 'default' }}
    >
      {/* Left: Video */}
      <div className={styles.adPanel}>
        {currentAd.video_url ? (
          <video
            ref={videoRef}
            key={currentAd.id}
            src={currentAd.video_url}
            className={styles.adMedia}
            autoPlay muted playsInline loop={ads.length <= 1}
            onEnded={goNext}
          />
        ) : (
          <div className={styles.adPanelEmpty}>🎬</div>
        )}
      </div>

      <div className={styles.adDivider} />

      {/* Right: Images */}
      <div className={styles.adPanel}>
        {images.length > 0 ? (
          <img
            src={images[imgIdx]}
            alt={currentAd.title ?? 'Ad'}
            className={styles.adMedia}
          />
        ) : (
          <div className={styles.adPanelEmpty}>🖼️</div>
        )}
      </div>

      {(currentAd.title || ads.length > 1) && (
        <div className={styles.adFooter}>
          <span className={styles.adFooterTitle}>{currentAd.title ?? ''}</span>
        </div>
      )}
    </div>
  );
}

// ── Food Card ────────────────────────────────────────────────────────────────
function FoodCard({ food, isFav, onToggleFav }: { food: FoodItem; isFav: boolean; onToggleFav: () => void }) {
  const { isOpen, opensAt } = getRestaurantStatus(food.restaurant.opening_hours);

  return (
    <Link href={`/customer/item/${food.id}`} className={styles.card}>
      <div className={styles.cardImageWrap}>
        {food.image_url ? (
          <img src={food.image_url} alt={food.name} className={styles.cardImage} />
        ) : (
          <div className={`${styles.cardImage} ${styles.cardImagePlaceholder}`}>🍽️</div>
        )}
        <button
          className={`${styles.heartBtn}${isFav ? ` ${styles.heartBtnActive}` : ''}`}
          onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={18} fill={isFav ? '#FF4D6A' : 'none'} color={isFav ? '#FF4D6A' : 'rgba(255,255,255,0.9)'} />
        </button>
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardName}>{food.name}</p>
        <p className={styles.cardPrice}>₵{food.price.toFixed(2)}</p>

        <div className={styles.storePill}>
          {food.restaurant.logo_url ? (
            <img src={food.restaurant.logo_url} alt="" className={styles.storeLogo} />
          ) : (
            <div className={styles.storeLogoPlaceholder}>{food.restaurant.name[0]}</div>
          )}
          <span className={styles.storeName}>{food.restaurant.name}</span>
          <div className={styles.storeRating}>
            {'★'.repeat(Math.round(food.restaurant.rating || 0)).padEnd(5, '☆')}
          </div>
        </div>

        {food.restaurant.isNearby && <span className={styles.nearbyBadge}>Nearby</span>}
        {food.restaurant.distanceKm != null && Number.isFinite(food.restaurant.distanceKm) && (
          <p className={styles.distanceText}><MapPin size={10} /> {formatDistanceKm(food.restaurant.distanceKm)}</p>
        )}
      </div>

      {!isOpen && (
        <div className={styles.closedOverlay}>
          <div className={styles.closedPill}>
            <Clock size={16} color="#fff" />
            <span className={styles.closedText}>Closed</span>
            {opensAt && <span className={styles.opensAt}>Opens at {opensAt}</span>}
          </div>
        </div>
      )}
    </Link>
  );
}
