'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/',          icon: '🏠', label: '홈'      },
  { href: '/dashboard', icon: '📺', label: '대시보드'  },
  { href: '/ranking',   icon: '🏆', label: '랭킹'     },
  { href: '/battle',    icon: '⚔️',  label: '대항전'   },
  { href: '/admin',     icon: '⚙️',  label: '관리자'   },
];

export default function Nav() {
  const pathname = usePathname();

  // 대시보드는 TV 송출용이므로 네비 숨김 (별도 홈 버튼 있음)
  if (pathname.startsWith('/dashboard')) return null;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ── 데스크탑 상단 네비게이션 ────────────────────────── */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-14 items-center px-6
        bg-[#080812]/95 backdrop-blur-md border-b border-white/5">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2.5 mr-10 flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-black">M</span>
          </div>
          <span className="text-white font-bold text-sm tracking-wide">매플 순공리그</span>
        </Link>

        {/* 링크 */}
        <div className="flex items-center gap-1">
          {ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── 모바일 하단 탭바 ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16
        bg-[#080812]/97 backdrop-blur-md border-t border-white/5
        flex items-center">
        {ITEMS.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            >
              <span className={`text-xl leading-none transition-all ${active ? 'scale-110' : 'opacity-50'}`}>
                {icon}
              </span>
              <span className={`text-[10px] font-semibold tracking-wide ${
                active ? 'text-blue-400' : 'text-gray-600'
              }`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-blue-500 rounded-full"
                  style={{ boxShadow: '0 0 6px #3B82F6' }} />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
