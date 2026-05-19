'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Trash2, RefreshCw, MessageSquare } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { ItemReview } from '@/types';
import styles from './reviews.module.css';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ItemReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ItemReview | null>(null);
  const [acting, setActing] = useState(false);

  const recalcRating = async (restaurantId?: string) => {
    if (!restaurantId) return;
    const { data } = await supabase.from('item_reviews').select('rating, item:menu_items!inner(restaurant_id)').eq('status', 'approved').eq('item.restaurant_id', restaurantId);
    const ratings = (data ?? []).map((r: any) => Number(r.rating)).filter(Number.isFinite);
    const count = ratings.length;
    const avg = count > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / count : 0;
    await supabase.from('restaurants').update({ rating: +avg.toFixed(1), rating_count: count }).eq('id', restaurantId);
  };

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('item_reviews')
      .select('*, customer:profiles(id, full_name, phone), item:menu_items(id, name, restaurant:restaurants(id, name))')
      .order('created_at', { ascending: false });
    if (data) setReviews(data as ItemReview[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleDelete = async () => {
    if (!detail || !confirm('Delete this review? This cannot be undone.')) return;
    setActing(true);
    const restaurantId = (detail.item as any)?.restaurant?.id;
    await supabase.from('item_reviews').delete().eq('id', detail.id);
    await recalcRating(restaurantId);
    setActing(false); setDetail(null); fetchReviews();
  };

  const filtered = reviews.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.customer?.full_name ?? '').toLowerCase().includes(q)
      || (r.item?.name ?? '').toLowerCase().includes(q)
      || ((r.item as any)?.restaurant?.name ?? '').toLowerCase().includes(q)
      || r.body.toLowerCase().includes(q);
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><h1 className={styles.headerTitle}>Comments</h1><p className={styles.headerSub}>Manage customer comments</p></div>
        <button className={styles.refreshBtn} onClick={fetchReviews} aria-label="Refresh"><RefreshCw size={20} color="var(--color-primary)" /></button>
      </div>

      <div className={styles.searchBar}>
        <Search size={18} color="var(--color-text-muted)" />
        <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by customer, item, or restaurant..." />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="var(--color-text-muted)" /></button>}
      </div>

      {loading ? <div className="page-loader"><span className="spinner spinner--primary" /></div>
        : filtered.length === 0 ? (
          <div className={styles.empty}>
            <MessageSquare size={40} color="var(--color-text-muted)" />
            <p className={styles.emptyTitle}>No comments yet</p>
            <p className={styles.emptySub}>Customer comments will appear here.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(r => (
              <button key={r.id} className={styles.card} onClick={() => setDetail(r)}>
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <p className={styles.cardItemName}>{r.item?.name ?? 'Unknown item'}</p>
                    {(r.item as any)?.restaurant?.name && (
                      <p className={styles.vendorName}>🏪 {(r.item as any).restaurant.name}</p>
                    )}
                    <p className={styles.cardStars}>{'★'.repeat(r.rating).padEnd(5, '☆')}</p>
                  </div>
                </div>
                <p className={styles.cardBody}>{r.body}</p>
                {((r as any).image_urls?.length > 0) && (
                  <div className={styles.cardPhotoRow}>
                    {((r as any).image_urls as string[]).slice(0, 3).map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className={styles.cardPhotoThumb} />
                    ))}
                    <span className={styles.cardPhotoBadge}>📷 {(r as any).image_urls.length}</span>
                  </div>
                )}
                <div className={styles.cardFooter}>
                  <div className={styles.avatarSmall}>{(r.customer?.full_name ?? '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <p className={styles.cardAuthor}>{r.customer?.full_name ?? '(Unknown)'}</p>
                    {r.customer?.phone && <p className={styles.cardPhone}>{(r.customer as any).phone}</p>}
                  </div>
                  <p className={styles.cardDate}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </button>
            ))}
          </div>
        )}

      {detail && (
        <div className={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.handle} />
            <button className={styles.modalClose} onClick={() => setDetail(null)}><X size={22} /></button>
            <div className={styles.modalScroll}>
              <p className={styles.modalItemName}>{detail.item?.name ?? 'Unknown item'}</p>
              {(detail.item as any)?.restaurant?.name && <p className={styles.modalRestName}>🏪 {(detail.item as any).restaurant.name}</p>}
              <p className={styles.modalStars}>{'★'.repeat(detail.rating).padEnd(5, '☆')} {detail.rating}.0 out of 5</p>
              <div className={styles.authorRow}>
                <div className={styles.avatarMed}>{(detail.customer?.full_name ?? '?')[0].toUpperCase()}</div>
                <div>
                  <p className={styles.authorName}>{detail.customer?.full_name ?? '(No name)'}</p>
                  {(detail.customer as any)?.phone && <p className={styles.authorPhone}>📞 {(detail.customer as any).phone}</p>}
                  <p className={styles.reviewDate}>{new Date(detail.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div className={styles.bodyBox}><p className={styles.bodyText}>{detail.body}</p></div>
              {((detail as any).image_urls?.length > 0) && (
                <div className={styles.modalPhotos}>
                  <p className={styles.noteLabel}>📸 Customer photos ({(detail as any).image_urls.length})</p>
                  <div className={styles.modalPhotoRow}>
                    {((detail as any).image_urls as string[]).map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className={styles.modalPhoto} />
                    ))}
                  </div>
                </div>
              )}
              <button className={styles.deleteBtn} onClick={handleDelete} disabled={acting}>
                {acting ? <span className="spinner" /> : <><Trash2 size={18} /> Delete Comment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
