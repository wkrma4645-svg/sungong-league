import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '매플 순공리그 - 학교 대항전',
};

export default function BattleLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
