'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/services/supabase';
import styles from './subscriptions.module.css';

interface Sub { id: string; restaurant_id: string; plan_id: string | null; end_date: string; status: string; notes: string | null; created_at: string; restaurant: { name: string; food_category: string; city: string } | null; plan: { name: string; price: number; duration_days: number } | null; }

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'active' | 'expired' | 'all'>('active');

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vendor_subscriptions')
      .select('*, restaurant:restaurants(name,food_category,city), plan:subscription_plans(name,price,duration_days)')
      .order('created_at', { ascending: false });
    if (data) setSubs(data as Sub[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const now = new Date();
  const filtered = subs.filter(s => {
    if (tab === 'active') return new Date(s.end_date) >= now;
    if (tab === 'expired') return new Date(s.end_date) < now;
    return true;
  }).filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.restaurant?.name ?? '').toLowerCase().includes(q) || (s.plan?.name ?? '').toLowerCase().includes(q);
  });

  const TABS: { key: typeof tab; label: string }[] = [{ key: 'active', label: 'Active' }, { key: 'expired', label: 'Expired' }, { key: 'all', label: 'All' }];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><h1 className={styles.headerTitle}>Subscriptions</h1><p className={styles.headerSub}>{subs.length} total records</p></div>
        <button className={styles.refreshBtn} onClick={fetchSubs} aria-label="Refresh"><RefreshCw size={18} color="var(--color-primary)" /></button>
      </div>

      <div className={styles.tabBar}>
        {TABS.map(t => <button key={t.key} className={`${styles.tab}${tab === t.key ? ` ${styles.tabActive}` : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      <div className={styles.searchBar}>
        <Search size={18} color="var(--color-text-muted)" />
        <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by restaurant or plan..." />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="var(--color-text-muted)" /></button>}
      </div>

      {loading ? <div className="page-loader"><span className="spinner spinner--primary" /></div> : (
        <div className={styles.list}>
          {filtered.length === 0 ? <div className={styles.empty}><p>No {tab !== 'all' ? tab : ''} subscriptions found</p></div>
            : filtered.map(s => {
              const isActive = new Date(s.end_date) >= now;
              const daysLeft = Math.max(0, Math.ceil((new Date(s.end_date).getTime() - now.getTime()) / 86400000));
              const pct = s.plan ? Math.min(100, (daysLeft / s.plan.duration_days) * 100) : 0;
              return (
                <div key={s.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardAvatar}>{(s.restaurant?.name?.[0] ?? '?').toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <p className={styles.cardName}>{s.restaurant?.name ?? 'Unknown'}</p>
                      <p className={styles.cardMeta}>{s.restaurant?.food_category} · {s.restaurant?.city}</p>
                      <p className={styles.cardPlan}>{s.plan?.name ?? 'Manual'} {s.plan ? `· ₵${s.plan.price}` : ''}</p>
                    </div>
                    <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeExpired}`}>
                      {isActive ? `${daysLeft}d left` : 'Expired'}
                    </span>
                  </div>
                  {isActive && (
                    <div className={styles.barTrack}><div className={styles.bar} style={{ width: `${pct}%` }} /></div>
                  )}
                  <div className={styles.cardFooter}>
                    <p className={styles.footerDate}>Expires {new Date(s.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    {s.notes && <p className={styles.footerNote}>{s.notes}</p>}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
