'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, MessageSquare, Megaphone, CreditCard, Settings } from 'lucide-react';
import styles from './AdminSidebar.module.css';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/vendors', label: 'Vendors', icon: Users },
  { href: '/admin/reviews', label: 'Comments', icon: MessageSquare },
  { href: '/admin/ads', label: 'Ads', icon: Megaphone },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🛡️</span>
        <span className={styles.logoText}>Admin</span>
      </div>
      <nav className={styles.nav}>
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} className={`${styles.navItem}${active ? ` ${styles.navItemActive}` : ''}`}>
              <Icon size={20} />
              <span className={styles.navLabel}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
