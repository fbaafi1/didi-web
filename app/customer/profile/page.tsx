'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, LogOut, Shield, Store, HelpCircle, FileText, Info, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { PLATFORM } from '@/constants/config';
import styles from './profile.module.css';

const TERMS = 'By using DiDi, you agree to browse and order from local restaurants responsibly. All orders are placed directly by contacting the restaurant. DiDi is a listing platform only.';
const PRIVACY = 'DiDi collects minimal data (email, name, phone) required for account creation. We do not sell your data. Location is used locally for proximity sorting only and is never stored on our servers.';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut, isAdmin, isVendor } = useAuthStore();
  const [supportEmail, setSupportEmail] = useState(PLATFORM.supportEmail);
  const [supportPhone, setSupportPhone] = useState(PLATFORM.supportPhone);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms');

  useEffect(() => {
    supabase.from('app_settings').select('support_email, support_phone').eq('id', 1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSupportEmail(data.support_email ?? PLATFORM.supportEmail);
          setSupportPhone(data.support_phone ?? PLATFORM.supportPhone);
        }
      });
  }, []);

  const handleSignOut = () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    signOut();
    router.push('/customer');
  };

  const menuItems = [
    ...(isAdmin ? [{ icon: <Shield size={20} color="var(--color-primary)" />, label: 'Admin dashboard', sub: 'Manage platform, vendors, and ads', href: '/admin' }] : []),
    ...(isVendor ? [{ icon: <Store size={20} color="var(--color-primary)" />, label: 'Restaurant dashboard', sub: 'Menu, orders view, and store profile', href: '/vendor' }] : []),
    { icon: <HelpCircle size={20} color="var(--color-primary)" />, label: 'Help & Support', sub: 'Contact us for assistance', action: () => alert(`Phone: ${supportPhone}\nEmail: ${supportEmail}`) },
    { icon: <FileText size={20} color="var(--color-primary)" />, label: 'Terms & Policies', sub: 'Terms of service & privacy', action: () => { setLegalTab('terms'); setLegalOpen(true); } },
    { icon: <Info size={20} color="var(--color-primary)" />, label: `About ${PLATFORM.name}`, sub: 'Version 1.0.0' },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft size={24} color="var(--color-text)" />
        </button>
        <h1 className={styles.headerTitle}>My Profile</h1>
        <div style={{ width: 24 }} />
      </div>

      {/* Avatar & Name */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>
          <span className={styles.avatarText}>{(profile?.full_name?.[0] ?? 'C').toUpperCase()}</span>
        </div>
        <p className={styles.name}>{profile?.full_name ?? 'Customer'}</p>
        <p className={styles.role}>
          {isAdmin ? 'Admin' : isVendor ? 'Restaurant partner' : 'Customer'} · {PLATFORM.name}
        </p>
        {profile?.phone && (
          <div className={styles.phoneRow}>
            <Phone size={14} color="var(--color-text-muted)" />
            <span className={styles.phone}>{profile.phone}</span>
          </div>
        )}
      </div>

      {/* Menu items */}
      <div className={styles.menuCard}>
        {menuItems.map((item, i) => {
          const content = (
            <>
              <div className={styles.menuIcon}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <p className={styles.menuLabel}>{item.label}</p>
                <p className={styles.menuSub}>{item.sub}</p>
              </div>
              <ChevronRight size={18} color="var(--color-text-muted)" />
            </>
          );
          if (item.href) return (
            <Link key={i} href={item.href} className={styles.menuItem}>{content}</Link>
          );
          return (
            <button key={i} className={styles.menuItem} onClick={item.action}>{content}</button>
          );
        })}
      </div>

      {/* Sign out */}
      <button className={styles.signOutBtn} onClick={handleSignOut} id="btn-signout">
        <LogOut size={20} color="var(--color-error)" />
        <span className={styles.signOutText}>Sign Out</span>
      </button>

      {/* Legal modal */}
      {legalOpen && (
        <div className={styles.modalOverlay} onClick={() => setLegalOpen(false)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Terms & Policies</h2>
              <button onClick={() => setLegalOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <div className={styles.tabRow}>
              <button className={`${styles.tab}${legalTab === 'terms' ? ` ${styles.tabActive}` : ''}`} onClick={() => setLegalTab('terms')}>Terms</button>
              <button className={`${styles.tab}${legalTab === 'privacy' ? ` ${styles.tabActive}` : ''}`} onClick={() => setLegalTab('privacy')}>Privacy</button>
            </div>
            <div className={styles.legalScroll}>
              <p className={styles.legalBody}>{legalTab === 'terms' ? TERMS : PRIVACY}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
