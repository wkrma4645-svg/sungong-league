import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '매플 순공리그 - 과목별 랭킹',
};

export default function RankingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
