import type { Metadata } from 'next';
import AdminSidebar from '@/components/AdminSidebar';

export const metadata: Metadata = {
  title: 'Admin — DiDi',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
