'use client';

import React, { useEffect, useState } from 'react';
import { Store, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { cacheGet, cacheSet } from '@/utils/cache';
import styles from './admin.module.css';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const cached = cacheGet<typeof stats>('admin_stats');
      if (cached) { setStats(cached); setLoading(false); }
      try {
        const [totalRes, pendingRes] = await Promise.all([
          supabase.from('restaurants').select('id, is_approved, subscription_expires_at'),
          supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        ]);
        type Row = { id: string; is_approved: boolean | null; subscription_expires_at: string | null };
        const all = (totalRes.data ?? []) as Row[];
        const now = new Date();
        const active  = all.filter(r => r.is_approved && r.subscription_expires_at && new Date(r.subscription_expires_at) >= now).length;
        const expired = all.filter(r => r.is_approved && (!r.subscription_expires_at || new Date(r.subscription_expires_at) < now)).length;
        const fresh = { total: all.length, active, pending: pendingRes.count ?? 0, expired };
        setStats(fresh);
        cacheSet('admin_stats', fresh);
      } catch { /* keep cache */ }
      setLoading(false);
    };
    load();
  }, []);

  const statItems = [
    { label: 'Total Restaurants', value: stats.total,   icon: <Store size={20} />,         color: 'var(--color-primary)' },
    { label: 'Active Listings',   value: stats.active,  icon: <CheckCircle size={20} />,   color: 'var(--color-success)' },
    { label: 'Pending Approval',  value: stats.pending, icon: <Clock size={20} />,         color: 'var(--color-warning)' },
    { label: 'Expired Sub',       value: stats.expired, icon: <AlertCircle size={20} />,   color: 'var(--color-error)' },
  ];

  const steps = [
    { step: '1', text: 'Vendor registers on the platform' },
    { step: '2', text: 'Go to Vendors tab → review & approve' },
    { step: '3', text: 'Assign a subscription plan + duration' },
    { step: '4', text: 'Restaurant goes live for customers to browse' },
    { step: '5', text: 'Renew subscription when it expires' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}><h1 className={styles.headerTitle}>Platform Overview</h1></div>
      <div className={styles.scroll}>
        {loading ? (
          <div className="page-loader"><span className="spinner spinner--primary" /></div>
        ) : (
          <div className={styles.statsGrid}>
            {statItems.map(s => (
              <div key={s.label} className={styles.statCard} style={{ borderLeftColor: s.color }}>
                <div className={styles.statIcon} style={{ background: s.color + '22', color: s.color }}>{s.icon}</div>
                <p className={styles.statValue}>{s.value}</p>
                <p className={styles.statLabel}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className={styles.guideCard}>
          <p className={styles.guideTitle}>Admin Workflow</p>
          {steps.map(g => (
            <div key={g.step} className={styles.guideRow}>
              <div className={styles.stepBadge}><span className={styles.stepNum}>{g.step}</span></div>
              <p className={styles.guideText}>{g.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
