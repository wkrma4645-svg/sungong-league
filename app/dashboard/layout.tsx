import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '매플 순공리그 - 리더보드',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
