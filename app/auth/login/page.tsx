'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, Phone, User, Store, MapPin, Map, UtensilsCrossed, Info, ArrowLeft } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { FOOD_CATEGORIES, PLATFORM, FoodCategory } from '@/constants/config';
import styles from './login.module.css';

type AuthTab = 'signin' | 'register';
type RegisterRole = 'customer' | 'vendor';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo     = searchParams.get('returnTo');
  const returnItemId = searchParams.get('returnItemId');

  const [tab, setTab] = useState<AuthTab>('signin');

  // ── Sign In state ──────────────────────────────────────────────
  const [siEmail,    setSiEmail]    = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPwd,  setSiShowPwd]  = useState(false);
  const [siLoading,  setSiLoading]  = useState(false);
  const [siError,    setSiError]    = useState('');

  // ── Register state ─────────────────────────────────────────────
  const [regRole,        setRegRole]     = useState<RegisterRole>('customer');
  const [regName,        setRegName]     = useState('');
  const [regEmail,       setRegEmail]    = useState('');
  const [regPassword,    setRegPassword] = useState('');
  const [regPhone,       setRegPhone]    = useState('');
  const [regShowPwd,     setRegShowPwd]  = useState(false);
  const [restName,       setRestName]    = useState('');
  const [restCategory,   setRestCat]     = useState<FoodCategory>(FOOD_CATEGORIES[0]);
  const [restAddress,    setRestAddress] = useState('');
  const [restCity,       setRestCity]    = useState('');
  const [restPhone,      setRestPhone]   = useState('');
  const [regLoading,     setRegLoading]  = useState(false);
  const [regError,       setRegError]    = useState('');

  const redirectAfterAuth = () => {
    if (returnItemId?.trim()) {
      router.replace(`/customer/item/${returnItemId}`);
      return;
    }
    if (returnTo?.trim()) {
      router.replace(returnTo);
      return;
    }
    router.replace('/customer');
  };

  // ── Sign In ────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiError('');
    if (!siEmail.trim() || !siPassword) {
      setSiError('Please enter your email and password.');
      return;
    }
    setSiLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email:    siEmail.trim().toLowerCase(),
      password: siPassword,
    });
    setSiLoading(false);
    if (error) { setSiError(error.message); return; }
    redirectAfterAuth();
  };

  // ── Register ───────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!regName.trim())          { setRegError('Please enter your full name.'); return; }
    if (!regEmail.trim())         { setRegError('Please enter your email.'); return; }
    if (regPassword.length < 6)   { setRegError('Password must be at least 6 characters.'); return; }
    if (regRole === 'vendor' && !restName.trim())  { setRegError('Please enter your restaurant name.'); return; }
    if (regRole === 'vendor' && !restPhone.trim()) { setRegError('Please enter a restaurant phone number (customers will call this to order).'); return; }

    setRegLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email:    regEmail.trim().toLowerCase(),
        password: regPassword,
        options: {
          data: {
            full_name: regName.trim(),
            role:      regRole,
            phone:     regPhone.trim() || null,
          },
        },
      });

      if (error || !data.user) throw new Error(error?.message ?? 'Registration failed.');
      const userId = data.user.id;

      await supabase.from('profiles').upsert(
        { id: userId, full_name: regName.trim(), role: regRole, phone: regPhone.trim() || null },
        { onConflict: 'id' },
      );

      if (regRole === 'vendor') {
        const { error: restErr } = await supabase.from('restaurants').insert({
          vendor_id:     userId,
          name:          restName.trim(),
          food_category: restCategory,
          address:       restAddress.trim() || null,
          city:          restCity.trim() || null,
          phone:         restPhone.trim(),
          is_approved:   false,
        });
        if (restErr) throw new Error(restErr.message);

        setRegLoading(false);
        alert('Registration Submitted! 🎉\nYour restaurant is pending admin approval. Sign in to check your dashboard status.');
        setTab('signin');
      } else {
        setRegLoading(false);
        if (data.session) redirectAfterAuth();
      }
    } catch (err: any) {
      setRegLoading(false);
      setRegError(err.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className={styles['login-page']}>
      <div className={styles['login-card']}>

        {/* Back button */}
        <button
          className="btn-secondary"
          style={{ width: 'auto', marginBottom: 20, padding: '8px 16px' }}
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Header */}
        <div className={styles['login-header']}>
          <div className={styles['login-logo']}>
            <span className={styles['login-logo-text']}>DiDi</span>
          </div>
          <div>
            <h1 className={styles['login-title']}>{PLATFORM.name}</h1>
            <p className={styles['login-subtitle']}>
              {tab === 'signin' ? 'Welcome back!' : 'Join the marketplace'}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className={styles['login-tabs']} role="tablist">
          <button
            id="tab-signin"
            role="tab"
            aria-selected={tab === 'signin'}
            className={`${styles['login-tab']}${tab === 'signin' ? ` ${styles.active}` : ''}`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            id="tab-register"
            role="tab"
            aria-selected={tab === 'register'}
            className={`${styles['login-tab']}${tab === 'register' ? ` ${styles.active}` : ''}`}
            onClick={() => setTab('register')}
          >
            Create Account
          </button>
        </div>

        {tab === 'signin' ? (
          /* ── SIGN IN FORM ── */
          <form className={styles['login-form']} onSubmit={handleSignIn} noValidate>
            {siError && <div className={styles['error-msg']} role="alert">{siError}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="si-email">
                <Mail size={13} /> Email Address
              </label>
              <div className="input-wrap">
                <input
                  id="si-email"
                  className="form-input"
                  type="email"
                  placeholder="you@example.com"
                  value={siEmail}
                  onChange={e => setSiEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="si-password">
                <Lock size={13} /> Password
              </label>
              <div className={`input-wrap ${styles['pwd-row']}`}>
                <input
                  id="si-password"
                  className="form-input"
                  type={siShowPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={siPassword}
                  onChange={e => setSiPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles['eye-btn']}
                  onClick={() => setSiShowPwd(!siShowPwd)}
                  aria-label={siShowPwd ? 'Hide password' : 'Show password'}
                >
                  {siShowPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              id="btn-signin"
              type="submit"
              className="btn-primary"
              disabled={siLoading}
            >
              {siLoading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>

        ) : (
          /* ── REGISTER FORM ── */
          <form className={styles['login-form']} onSubmit={handleRegister} noValidate>
            {regError && <div className={styles['error-msg']} role="alert">{regError}</div>}

            {/* Role selector */}
            <div className={styles['role-row']}>
              <button
                type="button"
                id="role-customer"
                className={`${styles['role-btn']}${regRole === 'customer' ? ` ${styles.active}` : ''}`}
                onClick={() => setRegRole('customer')}
              >
                <User size={20} color={regRole === 'customer' ? '#fff' : 'var(--color-text-muted)'} />
                <span className={styles['role-btn-label']}>Customer</span>
                <span className={styles['role-btn-sub']}>Browse menus</span>
              </button>
              <button
                type="button"
                id="role-vendor"
                className={`${styles['role-btn']}${regRole === 'vendor' ? ` ${styles.active}` : ''}`}
                onClick={() => setRegRole('vendor')}
              >
                <Store size={20} color={regRole === 'vendor' ? '#fff' : 'var(--color-text-muted)'} />
                <span className={styles['role-btn-label']}>Vendor</span>
                <span className={styles['role-btn-sub']}>List restaurant</span>
              </button>
            </div>

            {/* Common fields */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name"><User size={13} /> Full Name</label>
              <div className="input-wrap">
                <input id="reg-name" className="form-input" type="text" placeholder="John Mensah"
                  value={regName} onChange={e => setRegName(e.target.value)} autoComplete="name" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email"><Mail size={13} /> Email Address</label>
              <div className="input-wrap">
                <input id="reg-email" className="form-input" type="email" placeholder="you@example.com"
                  value={regEmail} onChange={e => setRegEmail(e.target.value)} autoComplete="email" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password"><Lock size={13} /> Password</label>
              <div className={`input-wrap ${styles['pwd-row']}`}>
                <input id="reg-password" className="form-input" type={regShowPwd ? 'text' : 'password'}
                  placeholder="Min. 6 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  autoComplete="new-password" required />
                <button type="button" className={styles['eye-btn']} onClick={() => setRegShowPwd(!regShowPwd)}
                  aria-label={regShowPwd ? 'Hide password' : 'Show password'}>
                  {regShowPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone"><Phone size={13} /> Phone Number</label>
              <div className="input-wrap">
                <input id="reg-phone" className="form-input" type="tel" placeholder="e.g. 0592649039"
                  value={regPhone} onChange={e => setRegPhone(e.target.value)} autoComplete="tel" />
              </div>
            </div>

            {/* Vendor-only restaurant fields */}
            {regRole === 'vendor' && (
              <>
                <div className={styles['section-divider']}>
                  <div className={styles['divider-line']} />
                  <span className={styles['divider-label']}>Restaurant Info</span>
                  <div className={styles['divider-line']} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rest-name"><UtensilsCrossed size={13} /> Restaurant Name *</label>
                  <div className="input-wrap">
                    <input id="rest-name" className="form-input" type="text" placeholder="e.g. Mama's Kitchen"
                      value={restName} onChange={e => setRestName(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Food Category</label>
                  <div className={styles['category-chips']}>
                    {FOOD_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`${styles['cat-chip']}${restCategory === c ? ` ${styles.active}` : ''}`}
                        onClick={() => setRestCat(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rest-phone"><Phone size={13} /> Restaurant Phone * (for customer orders)</label>
                  <div className="input-wrap">
                    <input id="rest-phone" className="form-input" type="tel" placeholder="e.g. 0592649039"
                      value={restPhone} onChange={e => setRestPhone(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="rest-address"><MapPin size={13} /> Address</label>
                  <div className="input-wrap">
                    <input id="rest-address" className="form-input" type="text" placeholder="Street / Area"
                      value={restAddress} onChange={e => setRestAddress(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="rest-city"><Map size={13} /> City</label>
                  <div className="input-wrap">
                    <input id="rest-city" className="form-input" type="text" placeholder="e.g. Kumasi"
                      value={restCity} onChange={e => setRestCity(e.target.value)} />
                  </div>
                </div>

                <div className={styles['note-box']}>
                  <Info size={15} color="var(--color-text-muted)" />
                  <p className={styles['note-text']}>
                    Your restaurant will be visible after admin approval and subscription assignment.
                  </p>
                </div>
              </>
            )}

            <button
              id="btn-register"
              type="submit"
              className="btn-primary"
              disabled={regLoading}
            >
              {regLoading
                ? <span className="spinner" />
                : regRole === 'customer' ? 'Create Account' : 'Submit Restaurant'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
