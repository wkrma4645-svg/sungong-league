'use client';

import { useEffect, useMemo, useState } from 'react';

// ─── Types / Constants ────────────────────────────────────────────────────────

type SubjectKey = 'math' | 'english' | 'korean' | 'science' | 'social' | 'etc';

interface Student  { id: string; name: string; school: string; grade: string; is_active: boolean; }
interface DailyRec { student_id: string; math_hours: number; english_hours: number; korean_hours: number; science_hours: number; social_hours: number; etc_hours: number; total_hours: number; }

const TABS: { key: SubjectKey; label: string; color: string; glow: string }[] = [
  { key: 'math',    label: '수학', color: '#60A5FA', glow: 'rgba(96,165,250,0.3)'   },
  { key: 'english', label: '영어', color: '#34D399', glow: 'rgba(52,211,153,0.3)'   },
  { key: 'korean',  label: '국어', color: '#C084FC', glow: 'rgba(192,132,252,0.3)'  },
  { key: 'science', label: '과학', color: '#FB923C', glow: 'rgba(251,146,60,0.3)'   },
  { key: 'social',  label: '사회', color: '#F43F5E', glow: 'rgba(244,63,94,0.3)'    },
  { key: 'etc',     label: '기타', color: '#94A3B8', glow: 'rgba(148,163,184,0.25)' },
];

const SUBJECT_FIELD: { [K in SubjectKey]: keyof DailyRec } = {
  math:    'math_hours',
  english: 'english_hours',
  korean:  'korean_hours',
  science: 'science_hours',
  social:  'social_hours',
  etc:     'etc_hours',
};

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RankingPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records,  setRecords]  = useState<DailyRec[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<SubjectKey>('math');

  useEffect(() => {
    Promise.all([
      fetch('/api/data/students', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/data/records', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([studs, recs]) => {
      setStudents(Array.isArray(studs) ? studs : []);
      setRecords(Array.isArray(recs) ? recs : []);
      setLoading(false);
    });
  }, []);

  // 과목별 순위 계산
  const ranked = useMemo(() => {
    const field = SUBJECT_FIELD[tab];
    return students
      .map(s => {
        const recs  = records.filter(r => r.student_id === s.id);
        const total = Math.round(recs.reduce((a, r) => a + ((r[field] as number) ?? 0), 0) * 10) / 10;
        return { ...s, total };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }, [students, records, tab]);

  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div className="min-h-screen pb-20 md:pb-8" style={{ background: '#0a0a0f', color: '#E5E7EB' }}>
      {/* ── 헤더 ── */}
      <header className="px-6 pt-8 pb-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs font-bold tracking-[0.4em] text-blue-500 uppercase mb-1">SEASON 2</p>
        <h1 className="text-2xl font-black tracking-tight"
          style={{ textShadow: '0 0 20px rgba(96,165,250,0.5)' }}>
          과목별 랭킹
        </h1>
        <p className="text-gray-600 text-sm mt-1">누적 공부 시간 기준</p>
      </header>

      {/* ── 과목 탭 ── */}
      <div className="px-3 sm:px-4 pt-4 pb-2 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-shrink-0 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all min-h-[36px]"
            style={tab === t.key ? {
              background: t.glow,
              color: t.color,
              border: `1px solid ${t.color}50`,
              boxShadow: `0 0 12px ${t.glow}`,
            } : {
              background: 'rgba(255,255,255,0.04)',
              color: '#6B7280',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 리더보드 ── */}
      <main className="px-4 pt-2 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
              style={{ boxShadow: '0 0 12px #3B82F6' }} />
            <p className="text-gray-600 text-sm">로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-1.5 sm:space-y-2">
            {/* 컬럼 헤더 */}
            <div className="grid text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-700 px-3 sm:px-4 py-2"
              style={{ gridTemplateColumns: '2.2rem 1fr 4rem' }}>
              <span className="text-center">#</span>
              <span>이름</span>
              <span className="text-right" style={{ color: activeTab.color }}>{activeTab.label}</span>
            </div>

            {ranked.map(row => {
              const isTop3 = row.rank <= 3;
              const mColor = isTop3 ? MEDAL_COLOR[row.rank - 1] : null;

              return (
                <div
                  key={row.id}
                  className="grid items-center rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 transition-all"
                  style={{
                    gridTemplateColumns: '2.2rem 1fr 4rem',
                    background: isTop3
                      ? `linear-gradient(120deg, ${mColor}15 0%, ${activeTab.color}0a 60%, rgba(12,12,20,0.95) 100%)`
                      : `linear-gradient(120deg, ${activeTab.color}08 0%, rgba(12,12,20,0.95) 100%)`,
                    border: `1px solid ${isTop3 ? mColor + '30' : activeTab.color + '15'}`,
                    boxShadow: isTop3 ? `0 0 20px ${mColor}12` : 'none',
                  }}
                >
                  <div className="flex justify-center">
                    {isTop3 ? (
                      <span className="text-lg sm:text-xl" style={{ filter: `drop-shadow(0 0 5px ${mColor})` }}>{MEDAL[row.rank - 1]}</span>
                    ) : (
                      <span className="text-xs sm:text-sm font-bold tabular-nums" style={{ color: '#4B5563' }}>{row.rank}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="font-bold text-sm block truncate"
                      style={{ color: isTop3 ? '#FFFFFF' : '#D1D5DB', textShadow: isTop3 ? `0 0 8px ${mColor}60` : 'none' }}>
                      {row.name}
                    </span>
                    <span className="text-[10px] text-gray-600">{row.school} {row.grade}</span>
                  </div>

                  <span className="text-right font-black text-sm sm:text-base tabular-nums"
                    style={{ color: row.total > 0 ? activeTab.color : '#374151', textShadow: row.total > 0 ? `0 0 8px ${activeTab.glow}` : 'none' }}>
                    {row.total > 0 ? `${row.total}h` : '—'}
                  </span>
                </div>
              );
            })}

            {ranked.length === 0 && (
              <div className="text-center py-16 text-gray-600">데이터가 없습니다</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
