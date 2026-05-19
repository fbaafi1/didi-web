'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid, UtensilsCrossed, Store,
  User, Settings, ShoppingBag,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

/**
 * Persistent navigation bar.
 * - Admin routes: hidden (AdminSidebar handles those)
 * - Customer routes: top bar with logo + profile shortcut
 * - Vendor routes: top bar + bottom tab bar with 4 tabs
 */
export default function NavBar() {
  const { session, profile, isAdmin, isVendor } = useAuthStore();
  const pathname = usePathname();

  // Admin panel uses its own sidebar — no top nav
  if (pathname.startsWith('/admin')) return null;
  // Auth pages — no nav
  if (pathname.startsWith('/auth')) return null;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  const vendorLinks = [
    { href: '/vendor',             icon: <LayoutGrid size={22} />,      label: 'Dashboard', exact: true },
    { href: '/vendor/menu',        icon: <UtensilsCrossed size={22} />, label: 'Menu' },
    { href: '/vendor/restaurant',  icon: <Store size={22} />,           label: 'Restaurant' },
    { href: '/vendor/settings',    icon: <Settings size={22} />,        label: 'Settings' },
  ];

  const customerTopLinks = [
    { href: '/customer',         icon: <ShoppingBag size={20} />,  label: 'Marketplace' },
    { href: '/customer/profile', icon: <User size={20} />,         label: 'Profile' },
  ];

  if (isVendor && pathname.startsWith('/vendor')) {
    return (
      <>
        {/* Desktop top nav */}
        <nav className="top-nav__links" role="navigation" aria-label="Vendor navigation">
          {vendorLinks.map(({ href, icon, label, exact }) => (
            <Link key={href} href={href} className={`top-nav__link${isActive(href, exact) ? ' active' : ''}`} aria-label={label}>
              {icon}<span>{label}</span>
            </Link>
          ))}
        </nav>
        {/* Mobile bottom nav */}
        <nav className="bottom-nav" role="navigation" aria-label="Vendor mobile navigation">
          {vendorLinks.map(({ href, icon, label, exact }) => (
            <Link key={href} href={href} className={`bottom-nav__item${isActive(href, exact) ? ' active' : ''}`} aria-label={label}>
              {icon}<span>{label}</span>
            </Link>
          ))}
        </nav>
      </>
    );
  }

  // Customer top bar + mobile bottom nav
  return (
    <>
      <nav className="top-nav__links" role="navigation" aria-label="Customer navigation">
        {customerTopLinks.map(({ href, icon, label }) => (
          <Link key={href} href={href} className={`top-nav__link${isActive(href) ? ' active' : ''}`} aria-label={label}>
            {href === '/customer/profile' && profile?.full_name ? (
              <div className="bottom-nav__avatar">{profile.full_name[0].toUpperCase()}</div>
            ) : icon}
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {/* Mobile bottom nav for customer */}
      <nav className="bottom-nav" role="navigation" aria-label="Customer mobile navigation">
        {customerTopLinks.map(({ href, icon, label }) => (
          <Link key={href} href={href} className={`bottom-nav__item${isActive(href) ? ' active' : ''}`} aria-label={label}>
            {href === '/customer/profile' && profile?.full_name ? (
              <div className="bottom-nav__avatar">{profile.full_name[0].toUpperCase()}</div>
            ) : icon}
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
