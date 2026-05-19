import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import NavBar from '@/components/NavBar';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DiDi — Browse Local Restaurants',
  description: 'Browse local restaurant menus and call to order. DiDi is the easiest way to find food near you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-shell">

            {/* ── Top navigation bar ── */}
            <header className="top-nav" role="banner">
              <div className="top-nav__inner">
                <Link href="/customer" className="top-nav__logo" aria-label="DiDi home">
                  <div className="top-nav__logo-badge">
                    <span className="top-nav__logo-text">DiDi</span>
                  </div>
                  <span className="top-nav__brand">DiDi</span>
                </Link>

                {/* NavBar renders the role-based links */}
                <NavBar />
              </div>
            </header>

            {/* ── Page content ── */}
            <main className="page-content fade-in" id="main-content">
              {children}
            </main>

          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
