'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, MessageCircle, Clock, MapPin, Star } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { CATEGORY_ICONS, PLATFORM } from '@/constants/config';
import { Restaurant, MenuItem } from '@/types';
import { getRestaurantStatus } from '@/utils/openingHours';
import { cacheGet, cacheSet } from '@/utils/cache';
import styles from './restaurant.module.css';

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setCategory] = useState('All');

  const fetchData = useCallback(async () => {
    const cacheKey = `restaurant:${id}`;
    const cached = cacheGet<{ restaurant: Restaurant; menuItems: MenuItem[] }>(cacheKey);
    if (cached) { setRestaurant(cached.restaurant); setMenuItems(cached.menuItems); setLoading(false); }
    try {
      const [restRes, menuRes] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', id).single(),
        supabase.from('menu_items').select('*, category:categories(name,icon)').eq('restaurant_id', id).eq('is_available', true).order('sort_order'),
      ]);
      if (restRes.data) setRestaurant(restRes.data as Restaurant);
      if (menuRes.data) setMenuItems(menuRes.data as MenuItem[]);
      if (restRes.data || menuRes.data) {
        cacheSet(cacheKey, {
          restaurant: restRes.data as Restaurant ?? cached?.restaurant,
          menuItems: menuRes.data as MenuItem[] ?? cached?.menuItems ?? [],
        });
      }
    } catch { /* keep cache */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="page-loader"><span className="spinner spinner--primary" /></div>;
  if (!restaurant) return <div style={{ padding: 40, color: 'var(--color-text-muted)', textAlign: 'center' }}>Restaurant not found.</div>;

  const categories = ['All', ...Array.from(new Set(menuItems.map(m => (m as any).category?.name ?? 'Other')))];
  const displayItems = activeCategory === 'All' ? menuItems : menuItems.filter(m => ((m as any).category?.name ?? 'Other') === activeCategory);
  const { isOpen, opensAt } = getRestaurantStatus(restaurant.opening_hours);

  const handleCall = () => window.open(`tel:${restaurant.phone.replace(/\s/g, '')}`, '_self');
  const handleWhatsApp = () => {
    if (!restaurant.whatsapp) return;
    const clean = restaurant.whatsapp.replace(/[\s\-()+]/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
  };

  return (
    <div className={styles.page}>
      {/* Cover */}
      <div className={styles.coverWrap}>
        {restaurant.cover_url ? (
          <img src={restaurant.cover_url} alt={restaurant.name} className={styles.cover} />
        ) : (
          <div className={styles.coverPlaceholder}>{CATEGORY_ICONS[restaurant.food_category] ?? '🍽️'}</div>
        )}
        <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft size={22} color="#fff" />
        </button>
      </div>

      {/* Info card */}
      <div className={styles.infoCard}>
        <div className={styles.infoTop}>
          {restaurant.logo_url && <img src={restaurant.logo_url} alt="" className={styles.logo} />}
          <div className={styles.infoText}>
            <h1 className={styles.restName}>{restaurant.name}</h1>
            <div className={styles.metaRow}>
              <span className={styles.metaCat}>{CATEGORY_ICONS[restaurant.food_category] ?? '🍽️'} {restaurant.food_category}</span>
              <span className={styles.metaDot}>·</span>
              <MapPin size={13} color="var(--color-text-muted)" />
              <span className={styles.metaCity}>{restaurant.city}</span>
            </div>
            {restaurant.rating > 0 && (
              <div className={styles.ratingRow}>
                {'★'.repeat(Math.round(restaurant.rating)).padEnd(5, '☆')}
                <span className={styles.ratingCount}>({restaurant.rating_count})</span>
              </div>
            )}
          </div>
          <span className={`${styles.openBadge}${!isOpen ? ` ${styles.closedBadge}` : ''}`}>
            <span className={`${styles.openDot}${!isOpen ? ` ${styles.closedDot}` : ''}`} />
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>

        {restaurant.description && <p className={styles.description}>{restaurant.description}</p>}

        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}><Clock size={15} color="var(--color-primary)" /><span className={styles.detailText}>{restaurant.opening_hours}</span></div>
          {restaurant.address && <div className={styles.detailItem}><MapPin size={15} color="var(--color-primary)" /><span className={styles.detailText}>{restaurant.address}, {restaurant.city}</span></div>}
        </div>
      </div>

      {/* Category filter */}
      <div className={styles.catBarWrap}>
        <div className={styles.catBar}>
          {categories.map(c => (
            <button key={c} className={`${styles.catChip}${activeCategory === c ? ` ${styles.catChipActive}` : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className={styles.menuSection}>
        <p className={styles.menuTitle}>Menu ({displayItems.length} items)</p>
        {displayItems.length === 0 ? (
          <div className={styles.emptyMenu}><p>No items in this category</p></div>
        ) : (
          displayItems.map(item => (
            <Link key={item.id} href={`/customer/item/${item.id}`} className={styles.menuCard}>
              {item.image_url && <img src={item.image_url} alt={item.name} className={styles.menuImage} />}
              <div className={styles.menuInfo}>
                <p className={styles.menuName}>{item.name}</p>
                {item.description && <p className={styles.menuDesc}>{item.description}</p>}
                <div className={styles.menuBottom}>
                  <span className={styles.menuPrice}>₵{item.price.toFixed(2)}</span>
                  {!item.is_available && <span className={styles.unavailBadge}>Unavailable</span>}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className={styles.footer}><p className={styles.footerText}>Powered by {PLATFORM.name}</p></div>

      {/* Fixed CTA bar */}
      <div className={styles.ctaBar}>
        {!isOpen && (
          <div className={styles.closedBanner}>
            <Clock size={14} color="var(--color-warning)" />
            <span className={styles.closedBannerText}>Closed{opensAt ? ` · Opens at ${opensAt}` : ''}</span>
          </div>
        )}
        <div className={styles.ctaRow}>
          <button id="btn-rest-call" className={styles.callBtn} onClick={handleCall} disabled={!isOpen} style={{ opacity: isOpen ? 1 : 0.38 }}>
            <Phone size={18} /> Call to Order
          </button>
          {restaurant.whatsapp && (
            <button id="btn-rest-wa" className={styles.waBtn} onClick={handleWhatsApp} disabled={!isOpen} style={{ opacity: isOpen ? 1 : 0.38 }}>
              <MessageCircle size={18} /> WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
