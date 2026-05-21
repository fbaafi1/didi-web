'use client';

import React, { useEffect, useState } from 'react';
import { LogOut, HelpCircle, FileText, Info, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { PLATFORM } from '@/constants/config';
import styles from './settings.module.css';

export default function VendorSettingsPage() {
  const { profile, signOut } = useAuthStore();
  const [supportEmail, setSupportEmail] = useState(PLATFORM.supportEmail ?? '');
  const [supportPhone, setSupportPhone] = useState(PLATFORM.supportPhone ?? '');
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms');

  useEffect(() => {
    supabase.from('app_settings').select('support_email, support_phone').eq('id', 1).maybeSingle().then(({ data }: { data: { support_email: string | null; support_phone: string | null } | null }) => {
      if (data) { setSupportEmail(data.support_email ?? PLATFORM.supportEmail ?? ''); setSupportPhone(data.support_phone ?? PLATFORM.supportPhone ?? ''); }
    });
  }, []);

  const handleSupport = () => {
    const lines = [`Phone: ${supportPhone || 'Not set'}`, `Email: ${supportEmail || 'Not set'}`].join('\n');
    if (supportPhone) window.open(`tel:${supportPhone.replace(/\D/g, '')}`, '_self');
    else if (supportEmail) window.open(`mailto:${supportEmail}`, '_self');
    else alert(lines);
  };

  const handleSignOut = () => { if (confirm('Sign out of your account?')) signOut(); };

  const menuItems = [
    { icon: <HelpCircle size={20} color="var(--color-primary)" />, label: 'Help & Support', sub: 'Contact our support team', action: handleSupport },
    { icon: <FileText size={20} color="var(--color-primary)" />, label: 'Terms & Policies', sub: 'Terms of service & privacy', action: () => { setLegalTab('terms'); setLegalOpen(true); } },
    { icon: <Info size={20} color="var(--color-primary)" />, label: `About ${PLATFORM.name}`, sub: 'Version 1.0.0', action: () => {} },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}><h1 className={styles.headerTitle}>Settings</h1></div>

      <div className={styles.profileCard}>
        <div className={styles.avatar}>{(profile?.full_name?.[0] ?? 'V').toUpperCase()}</div>
        <div>
          <p className={styles.name}>{profile?.full_name ?? 'Vendor'}</p>
          <p className={styles.role}>Restaurant Partner · {PLATFORM.name}</p>
          {profile?.phone && <p className={styles.phone}>{profile.phone}</p>}
        </div>
      </div>

      <div className={styles.menuCard}>
        {menuItems.map((item, i) => (
          <button key={item.label} className={styles.menuItem} onClick={item.action}
            style={{ borderBottom: i < menuItems.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div className={styles.menuIcon}>{item.icon}</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p className={styles.menuLabel}>{item.label}</p>
              <p className={styles.menuSub}>{item.sub}</p>
            </div>
            <ChevronRight size={18} color="var(--color-text-muted)" />
          </button>
        ))}
      </div>

      <button className={styles.signOutBtn} onClick={handleSignOut} id="btn-vendor-signout">
        <LogOut size={20} color="var(--color-error)" />
        <span className={styles.signOutText}>Sign Out</span>
      </button>

      {legalOpen && (
        <div className={styles.modalOverlay} onClick={() => setLegalOpen(false)}>
          <div className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <p className={styles.modalTitle}>Terms &amp; Policies</p>
              <button onClick={() => setLegalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--color-text-secondary)' }}>✕</button>
            </div>
            <div className={styles.tabRow}>
              <button className={`${styles.tab}${legalTab === 'terms' ? ` ${styles.tabActive}` : ''}`} onClick={() => setLegalTab('terms')}>Terms</button>
              <button className={`${styles.tab}${legalTab === 'privacy' ? ` ${styles.tabActive}` : ''}`} onClick={() => setLegalTab('privacy')}>Privacy</button>
            </div>
            <div className={styles.legalScroll}>
              <p className={styles.legalBody}>
                {legalTab === 'terms'
                  ? `By using ${PLATFORM.name}, you agree to our terms of service. You must provide accurate information about your restaurant. You are responsible for the accuracy of your menu and pricing. ${PLATFORM.name} reserves the right to remove listings that violate our policies.`
                  : `Your data is protected under our privacy policy. We collect only the information necessary to operate the platform. We do not sell your personal data to third parties. You may request deletion of your account at any time by contacting support.`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
