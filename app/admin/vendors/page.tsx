'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { Restaurant, SubscriptionPlan } from '@/types';
import styles from './vendors.module.css';

type FilterTab = 'pending' | 'active' | 'expired' | 'all';

export default function AdminVendorsPage() {
  const { user } = useAuthStore();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [subModal, setSubModal] = useState(false);
  const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
  const [selectedPlan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [customDays, setCustomDays] = useState('');
  const [notes, setNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchAll = useCallback(async () => {
    const [restRes, plansRes] = await Promise.all([
      supabase.from('restaurants').select('*, vendor:profiles(full_name,phone,role)').order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('price'),
    ]);
    if (restRes.data) setRestaurants(restRes.data as Restaurant[]);
    if (plansRes.data) setPlans(plansRes.data as SubscriptionPlan[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now = new Date();
  const filtered = restaurants.filter(r => {
    if (tab === 'pending') return !r.is_approved;
    if (tab === 'active') return r.is_approved && r.subscription_expires_at && new Date(r.subscription_expires_at) >= now;
    if (tab === 'expired') return r.is_approved && (!r.subscription_expires_at || new Date(r.subscription_expires_at) < now);
    return true;
  }).filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.city ?? '').toLowerCase().includes(q) || (r.food_category ?? '').toLowerCase().includes(q) || ((r.vendor as any)?.full_name ?? '').toLowerCase().includes(q);
  });

  const handleApprove = async (rest: Restaurant) => {
    await supabase.from('restaurants').update({ is_approved: true }).eq('id', rest.id);
    fetchAll();
    alert(`${rest.name} has been approved. Now assign a subscription to make it live.`);
  };

  const handleReject = async (rest: Restaurant) => {
    if (!confirm(`Remove ${rest.name} from the platform?`)) return;
    await supabase.from('restaurants').delete().eq('id', rest.id);
    fetchAll();
  };

  const openSubModal = (rest: Restaurant) => { setSelectedRest(rest); setPlan(plans[0] ?? null); setCustomDays(''); setNotes(''); setSubModal(true); };

  const handleAssignSubscription = async () => {
    if (!selectedRest || !user) return;
    const days = customDays ? parseInt(customDays) : selectedPlan?.duration_days ?? 30;
    if (isNaN(days) || days <= 0) { alert('Enter a valid number of days.'); return; }
    setAssigning(true);
    const end = new Date(); end.setDate(end.getDate() + days);
    const { error } = await supabase.from('vendor_subscriptions').insert({
      vendor_id: selectedRest.vendor_id, restaurant_id: selectedRest.id,
      plan_id: selectedPlan?.id ?? null, assigned_by: user.id,
      end_date: end.toISOString(), status: 'active', notes: notes.trim() || null,
    });
    setAssigning(false);
    if (error) { alert(error.message); return; }
    setSubModal(false); fetchAll();
    alert(`${selectedRest.name} is now live for ${days} days (until ${end.toLocaleDateString()}).`);
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'pending', label: 'Pending' }, { key: 'active', label: 'Active' },
    { key: 'expired', label: 'Expired' }, { key: 'all', label: 'All' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}><h1 className={styles.headerTitle}>Vendors</h1></div>

      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.key} className={`${styles.tab}${tab === t.key ? ` ${styles.tabActive}` : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className={styles.searchBar}>
        <Search size={18} color="var(--color-text-muted)" />
        <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="var(--color-text-muted)" /></button>}
      </div>

      {loading ? <div className="page-loader"><span className="spinner spinner--primary" /></div> : (
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span style={{ fontSize: 48 }}>🏪</span><p>No {tab !== 'all' ? tab : ''} vendors found</p></div>
          ) : filtered.map(r => {
            const subExpiry = r.subscription_expires_at ? new Date(r.subscription_expires_at) : null;
            const isActive = r.is_approved && subExpiry && subExpiry >= now;
            const daysLeft = subExpiry ? Math.max(0, Math.ceil((subExpiry.getTime() - now.getTime()) / 86400000)) : 0;
            return (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardAvatar}>{r.name[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <p className={styles.cardName}>{r.name}</p>
                    <p className={styles.cardCategory}>{r.food_category} · {r.city}</p>
                    {r.vendor && <p className={styles.cardVendor}>👤 {(r.vendor as any).full_name ?? 'Vendor'}</p>}
                    {r.phone && <p className={styles.cardPhone}>📞 {r.phone}</p>}
                  </div>
                  <span className={`${styles.statusBadge} ${!r.is_approved ? styles.badgePending : isActive ? styles.badgeActive : styles.badgeExpired}`}>
                    {!r.is_approved ? 'Pending' : isActive ? `${daysLeft}d left` : 'Expired'}
                  </span>
                </div>
                <div className={styles.actions}>
                  {!r.is_approved ? (
                    <>
                      <button className={styles.approveBtn} onClick={() => handleApprove(r)}><CheckCircle size={16} /> Approve</button>
                      <button className={styles.rejectBtn} onClick={() => handleReject(r)}><XCircle size={16} /> Remove</button>
                    </>
                  ) : (
                    <button className={styles.subBtn} onClick={() => openSubModal(r)}><CreditCard size={16} /> {isActive ? 'Extend Subscription' : 'Assign Subscription'}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subModal && (
        <div className={styles.modalOverlay} onClick={() => setSubModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <p className={styles.modalTitle}>Assign Subscription</p>
              <button onClick={() => setSubModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24 }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {selectedRest && <div className={styles.restSummary}><p className={styles.restSummaryName}>{selectedRest.name}</p><p className={styles.restSummarySub}>{selectedRest.food_category} · {selectedRest.city}</p></div>}
              <p className={styles.sectionLabel}>Select Plan</p>
              {plans.map(p => (
                <button key={p.id} className={`${styles.planCard}${selectedPlan?.id === p.id ? ` ${styles.planCardActive}` : ''}`} onClick={() => { setPlan(p); setCustomDays(''); }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p className={styles.planName} style={{ color: selectedPlan?.id === p.id ? 'var(--color-primary)' : 'var(--color-text)' }}>{p.name}</p>
                    <p className={styles.planDays}>{p.duration_days} days · ₵{p.price}</p>
                    {p.features?.map((f, i) => <p key={i} className={styles.planFeature}>✓ {f}</p>)}
                  </div>
                  {selectedPlan?.id === p.id && <CheckCircle size={22} color="var(--color-primary)" />}
                </button>
              ))}
              <p className={styles.sectionLabel}>Or Custom Duration</p>
              <input className={styles.input} type="number" value={customDays} onChange={e => { setCustomDays(e.target.value); setPlan(null); }} placeholder="Number of days (e.g. 45)" />
              <p className={styles.sectionLabel}>Notes (optional)</p>
              <textarea className={styles.input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Paid via MoMo on 17/04/2026" rows={3} />
              {(selectedPlan || customDays) && (
                <div className={styles.summaryBox}>
                  Subscription will run for <strong>{customDays || selectedPlan?.duration_days} days</strong> and expire on <strong>{(() => { const d = new Date(); d.setDate(d.getDate() + parseInt(customDays || String(selectedPlan?.duration_days ?? 30))); return d.toLocaleDateString(); })()}</strong>.
                </div>
              )}
              <button className={`btn-primary${assigning ? ' disabled' : ''}`} onClick={handleAssignSubscription} disabled={assigning} id="btn-assign-sub">
                {assigning ? <span className="spinner" /> : 'Assign & Go Live'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
