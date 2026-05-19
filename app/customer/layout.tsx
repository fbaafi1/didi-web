import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer — DiDi',
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
