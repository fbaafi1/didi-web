'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CreditCard, UtensilsCrossed, Star, MapPin, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle, X, ExternalLink, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { PLATFORM } from '@/constants/config';
import { SubscriptionPlan, VendorSubscription } from '@/types';
import { cacheGet, cacheSet } from '@/utils/cache';
import styles from './vendor.module.css';

/* ── Paystack helpers (mirrors didi-app/services/paystack.ts) ── */
async function getAuthHeaders(): Promise<{ Authorization: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not logged in. Please sign in again.');
  return { Authorization: `Bearer ${token}` };
}

async function extractFunctionError(error: any, fallback: string): Promise<never> {
  const ctx = error?.context;
  if (ctx && typeof ctx.text === 'function') {
    const raw = await ctx.text();
    let message = raw || error?.message || fallback;
    try { const p = JSON.parse(raw); message = p?.error || p?.message || message; } catch { /* keep raw */ }
    throw new Error(message);
  }
  throw new Error(error?.message || fallback);
}

async function initiatePayment(restaurantId: string, planId: string, email: string) {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke('paystack-initiate-subscription', {
    body: { restaurantId, planId, email },
    headers,
  });
  if (error) return extractFunctionError(error, 'Failed to initialize payment');
  if (!data?.authorization_url || !data?.reference) throw new Error('Invalid payment response from server');
  return data as { authorization_url: string; reference: string };
}

async function verifyPayment(reference: string) {
  const headers = await getAuthHeaders();
  const { data, error } = await supabase.functions.invoke('paystack-verify-subscription', {
    body: { reference },
    headers,
  });
  if (error) return extractFunctionError(error, 'Failed to verify payment');
  return data as { success: boolean; message: string; subscription_end_date?: string };
}

/* ── Main component ──────────────────────────────────────────── */
export default function VendorDashboardPage() {
  const { profile, restaurant, fetchVendorRestaurant, user } = useAuthStore();
  const [subscription, setSubscription]     = useState<VendorSubscription | null>(null);
  const [plans, setPlans]                   = useState<SubscriptionPlan[]>([]);
  const [menuCount, setMenuCount]           = useState(0);
  const [toggling, setToggling]             = useState(false);
  const [payModalOpen, setPayModalOpen]     = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pendingRef, setPendingRef]         = useState<string | null>(null);
  const [paying, setPaying]                 = useState(false);
  const [verifying, setVerifying]           = useState(false);
  const [payError, setPayError]             = useState('');
  const [verifyMsg, setVerifyMsg]           = useState('');
  const [loading, setLoading]               = useState(true);

  const loadData = useCallback(async () => {
    if (!restaurant) { setLoading(false); return; }
    const cacheKey = `vendor_dashboard:${restaurant.id}`;
    const cached = cacheGet<any>(cacheKey);
    if (cached) {
      setSubscription(cached.subscription);
      setMenuCount(cached.menuCount);
      setPlans(cached.plans);
      if (!selectedPlanId && cached.plans.length) setSelectedPlanId(cached.plans[0].id);
      setLoading(false);
    }
    try {
      const [subRes, menuRes, plansRes] = await Promise.all([
        supabase.from('vendor_subscriptions').select('*, plan:subscription_plans(*)').eq('restaurant_id', restaurant.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('price'),
      ]);
      const sub       = subRes.data as VendorSubscription | null;
      const count     = menuRes.count ?? 0;
      const plansList = (plansRes.data as SubscriptionPlan[]) ?? [];
      setSubscription(sub); setMenuCount(count); setPlans(plansList);
      if (!selectedPlanId && plansList.length) setSelectedPlanId(plansList[0].id);
      cacheSet(cacheKey, { subscription: sub, menuCount: count, plans: plansList });
    } catch { /* keep cache */ }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleOpen = async () => {
    if (!restaurant) return;
    setToggling(true);
    await supabase.from('restaurants').update({ is_open: !restaurant.is_open }).eq('id', restaurant.id);
    if (user) await fetchVendorRestaurant(user.id);
    setToggling(false);
  };

  /* ── Payment handlers ── */
  const handleStartPayment = async () => {
    if (!restaurant || !selectedPlanId) return;
    const email = user?.email?.trim();
    if (!email) { setPayError('No account email found. Please sign out and sign in again.'); return; }
    setPayError('');
    setPaying(true);
    try {
      const res = await initiatePayment(restaurant.id, selectedPlanId, email);
      setPendingRef(res.reference);
      setPayModalOpen(false);
      // Open Paystack checkout in a new tab
      window.open(res.authorization_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setPayError(err.message ?? 'Could not start payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!pendingRef) { setVerifyMsg('No pending payment found. Start a payment first.'); return; }
    setVerifyMsg('');
    setVerifying(true);
    try {
      const result = await verifyPayment(pendingRef);
      if (!result.success) { setVerifyMsg(result.message); return; }
      setPendingRef(null);
      await loadData();
      if (user) await fetchVendorRestaurant(user.id);
      setVerifyMsg('✅ ' + result.message);
    } catch (err: any) {
      setVerifyMsg(err.message ?? 'Could not verify payment.');
    } finally {
      setVerifying(false);
    }
  };

  const isSubActive = subscription && new Date((subscription as any).end_date) >= new Date();
  const daysLeft    = subscription ? Math.max(0, Math.ceil((new Date((subscription as any).end_date).getTime() - Date.now()) / 86400000)) : 0;
  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null;

  /* ── Guards ── */
  if (!restaurant) return (
    <div className={styles.center}>
      <span style={{ fontSize: 56 }}>🏪</span>
      <p className={styles.pendingTitle}>No Restaurant Found</p>
      <p className={styles.pendingSub}>Your restaurant profile is being set up. Please contact support.</p>
    </div>
  );

  if (!restaurant.is_approved) return (
    <div className={styles.page}>
      <div className={styles.header}><h1 className={styles.headerTitle}>Dashboard</h1></div>
      <div className={styles.center}>
        <div className={styles.pendingBadge}>⏳</div>
        <p className={styles.pendingTitle}>Pending Approval</p>
        <p className={styles.pendingSub}>Your restaurant <strong>{restaurant.name}</strong> is under review.</p>
        {[{ icon: '✅', text: 'Account created successfully' }, { icon: '⏳', text: 'Admin review in progress' }, { icon: '🚀', text: 'Subscription assignment (after approval)' }].map(s => (
          <div key={s.text} className={styles.pendingCard}><span>{s.icon}</span><span className={styles.pendingCardText}>{s.text}</span></div>
        ))}
      </div>
    </div>
  );

  const stats = [
    { label: 'Menu Items',    value: String(menuCount),                                           color: 'var(--color-primary)',  icon: <UtensilsCrossed size={18} /> },
    { label: 'Subscription',  value: isSubActive ? 'Active' : 'Expired',                          color: isSubActive ? 'var(--color-success)' : 'var(--color-error)', icon: <CreditCard size={18} /> },
    { label: 'Rating',        value: restaurant.rating > 0 ? restaurant.rating.toFixed(1) + '★' : 'N/A', color: '#FFB800', icon: <Star size={18} /> },
    { label: 'City',          value: restaurant.city,                                              color: 'var(--color-info)',     icon: <MapPin size={18} /> },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Dashboard</h1>
          <p className={styles.headerSub}>Welcome, {profile?.full_name?.split(' ')[0] ?? 'Vendor'} 👋</p>
        </div>
        <div className={styles.statusDot} style={{ background: restaurant.is_open ? 'var(--color-success)' : 'var(--color-error)' }} />
      </div>

      <div className={styles.scroll}>

        {/* ── Subscription Status ── */}
        {!isSubActive ? (
          <div className={styles.alertCard}>
            <AlertTriangle size={20} color="var(--color-error)" />
            <div style={{ flex: 1 }}>
              <p className={styles.alertTitle}>Subscription Expired</p>
              <p className={styles.alertSub}>Your restaurant is not visible to customers. Pay now with Paystack.</p>
              <div className={styles.subActionRow}>
                <button className={styles.payBtn} onClick={() => { setPayError(''); setPayModalOpen(true); }} id="btn-pay-subscription">
                  <CreditCard size={16} /> Pay Subscription
                </button>
                <button
                  className={styles.verifyBtn}
                  onClick={handleVerifyPayment}
                  disabled={verifying || !pendingRef}
                  id="btn-verify-payment"
                >
                  {verifying ? <span className="spinner spinner--primary" /> : <><RefreshCw size={14} /> Verify Payment</>}
                </button>
              </div>
              {pendingRef && <p className={styles.pendingRef}>Pending ref: <code>{pendingRef}</code></p>}
              {verifyMsg && <p className={verifyMsg.startsWith('✅') ? styles.verifySuccess : styles.verifyError}>{verifyMsg}</p>}
            </div>
          </div>
        ) : (
          <div className={styles.subCard}>
            <div className={styles.subCardLeft}>
              <CheckCircle size={20} color="var(--color-success)" />
              <div>
                <p className={styles.subPlan}>{(subscription as any)?.plan?.name ?? 'Active'} Plan</p>
                <p className={styles.subExpiry}>{daysLeft} days remaining</p>
              </div>
            </div>
            <div className={styles.subBarTrack}>
              <div className={styles.subBar} style={{ width: `${Math.min(100, (daysLeft / ((subscription as any)?.plan?.duration_days ?? 30)) * 100)}%` }} />
            </div>
            <div className={styles.subActionRow}>
              <button className={styles.renewBtn} onClick={() => { setPayError(''); setPayModalOpen(true); }}>Renew / Extend</button>
              <button
                className={styles.verifyBtn}
                onClick={handleVerifyPayment}
                disabled={verifying || !pendingRef}
              >
                {verifying ? <span className="spinner spinner--primary" /> : <><RefreshCw size={14} /> Verify Payment</>}
              </button>
            </div>
            {pendingRef && <p className={styles.pendingRef}>Pending ref: <code>{pendingRef}</code></p>}
            {verifyMsg && <p className={verifyMsg.startsWith('✅') ? styles.verifySuccess : styles.verifyError}>{verifyMsg}</p>}
          </div>
        )}

        {/* ── Open/Closed toggle ── */}
        <div className={styles.toggleCard}>
          <div className={styles.toggleLeft}>
            <div className={styles.toggleDot} style={{ background: restaurant.is_open ? 'var(--color-success)' : 'var(--color-error)' }} />
            <div>
              <p className={styles.toggleTitle}>Restaurant is {restaurant.is_open ? 'Open' : 'Closed'}</p>
              <p className={styles.toggleSub}>{restaurant.is_open ? 'Customers can see your menu' : 'Hidden from customers'}</p>
            </div>
          </div>
          <button className={styles.toggleBtn} onClick={toggleOpen} disabled={toggling} aria-label="Toggle open status">
            {toggling ? <span className="spinner spinner--primary" /> : restaurant.is_open
              ? <ToggleRight size={36} color="var(--color-success)" />
              : <ToggleLeft size={36} color="var(--color-text-muted)" />}
          </button>
        </div>

        {/* ── Stats ── */}
        <div className={styles.statsGrid}>
          {stats.map(s => (
            <div key={s.label} className={styles.statCard} style={{ borderLeftColor: s.color }}>
              <div className={styles.statIcon} style={{ background: s.color + '22', color: s.color }}>{s.icon}</div>
              <p className={styles.statValue}>{s.value}</p>
              <p className={styles.statLabel}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tips ── */}
        <div className={styles.tipsCard}>
          <p className={styles.tipsTitle}>💡 Tips to attract customers</p>
          {['Add high-quality photos to all menu items', 'Keep your opening hours updated', 'Add a WhatsApp number for easy ordering', 'Write a clear restaurant description'].map(t => (
            <p key={t} className={styles.tipItem}>• {t}</p>
          ))}
        </div>
      </div>

      {/* ── Pay Modal ── */}
      {payModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setPayModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <p className={styles.modalTitle}>Pay Subscription</p>
              <button onClick={() => setPayModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={26} color="var(--color-text)" />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalHint}>
                Select a plan and click <strong>Proceed to Paystack</strong>. A checkout page will open in a new tab.
                After paying, return here and click <strong>Verify Payment</strong>.
              </p>

              {plans.length === 0 && (
                <p className={styles.modalHint} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No subscription plans available. Contact admin.
                </p>
              )}

              {plans.map(plan => (
                <button
                  key={plan.id}
                  className={`${styles.planCard}${selectedPlanId === plan.id ? ` ${styles.planCardActive}` : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p className={styles.planName}>{plan.name}</p>
                    <p className={styles.planMeta}>{plan.duration_days} days · {PLATFORM.currencySymbol}{plan.price}</p>
                    {plan.description && <p className={styles.planDesc}>{plan.description}</p>}
                  </div>
                  {selectedPlanId === plan.id && <CheckCircle size={20} color="var(--color-primary)" />}
                </button>
              ))}

              {payError && <p className={styles.verifyError}>{payError}</p>}

              {selectedPlan && (
                <div className={styles.summaryBox}>
                  <p><strong>{selectedPlan.name}</strong> — {selectedPlan.duration_days} days for {PLATFORM.currencySymbol}{selectedPlan.price}</p>
                </div>
              )}

              <button
                id="btn-proceed-paystack"
                className={`${styles.checkoutBtn}${(!selectedPlan || paying) ? ` ${styles.checkoutBtnDisabled}` : ''}`}
                onClick={handleStartPayment}
                disabled={!selectedPlan || paying}
              >
                {paying
                  ? <span className="spinner" />
                  : <><ExternalLink size={16} /> Proceed to Paystack</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
