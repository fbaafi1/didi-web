import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vendor Dashboard — DiDi',
};

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-content">
      {children}
    </div>
  );
}
