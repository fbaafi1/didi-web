import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — DiDi',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
