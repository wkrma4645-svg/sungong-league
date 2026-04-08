'use client';

import { useEffect, useMemo, useState } from 'react';

// ─── Types / Constants ────────────────────────────────────────────────────────

interface Student { id: string; name: string; school: string; grade: string; is_active: boolean; }
interface DailyRecord { student_id: string; total_hours: number; }

const SCHOOLS = ['오천고', '동성고', '영일고', '포은중', '신흥중', '동해중'];
const SEASON_START = '2026-03-16';
const K = 5; // 베이지안 수축 강도

const MEDAL       = ['🥇', '🥈', '🥉'];
const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_COLOR  = (i: number) => MEDAL_COLOR[i] ?? '#4B5563';

function elapsedDays() {
  const now   = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const start = new Date(SEASON_START);
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
}

// ─── Bayesian shrinkage helper ────────────────────────────────────────────────

interface GroupResult {
  label: string;
  n: number;
  rawAvg: number;      // 단순 평균
  score: number;       // 베이지안 보정 점수
}

function calcBayesian(groups: { label: string; avgs: number[] }[], globalAvg: number): GroupResult[] {
  return groups
    .filter(g => g.avgs.length > 0)
    .map(g => {
      const n      = g.avgs.length;
      const rawAvg = g.avgs.reduce((a, v) => a + v, 0) / n;
      const score  = (n / (n + K)) * rawAvg + (K / (n + K)) * globalAvg;
      return {
        label:  g.label,
        n,
        rawAvg: Math.round(rawAvg * 100) / 100,
        score:  Math.round(score  * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ─── Row Component ────────────────────────────────────────────────────────────

function BattleRow({ row, rank, maxScore }: { row: GroupResult; rank: number; maxScore: number }) {
  const isTop3  = rank <= 3;
  const mColor  = MEDAL_COLOR[rank - 1] ?? null;
  const barPct  = maxScore > 0 ? (row.score / maxScore) * 100 : 0;
  const diffPct = row.rawAvg > 0 ? Math.round(((row.score - row.rawAvg) / row.rawAvg) * 100) : 0;

  return (
    <div
      className="rounded-xl px-3 sm:px-5 py-3 sm:py-4 transition-all"
      style={{
        background: isTop3
          ? `linear-gradient(120deg, ${mColor}18 0%, rgba(12,12,22,0.97) 100%)`
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isTop3 ? mColor + '30' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isTop3 ? `0 0 24px ${mColor}10` : 'none',
      }}
    >
      <div className="flex items-center gap-2 sm:gap-4">
        {/* 순위 */}
        <div className="w-8 sm:w-10 flex-shrink-0 flex justify-center">
          {isTop3 ? (
            <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${mColor})` }}>
              {MEDAL[rank - 1]}
            </span>
          ) : (
            <span className="text-lg font-bold tabular-nums" style={{ color: '#4B5563' }}>{rank}</span>
          )}
        </div>

        {/* 이름 + 인원 */}
        <div className="flex-shrink-0 w-14 sm:w-20">
          <p
            className="font-black text-base leading-tight"
            style={{ color: isTop3 ? '#FFFFFF' : '#D1D5DB', textShadow: isTop3 ? `0 0 10px ${mColor}60` : 'none' }}
          >{row.label}</p>
          <p className="text-xs text-gray-600 mt-0.5">{row.n}명</p>
        </div>

        {/* 바 차트 */}
        <div className="flex-1">
          <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${barPct}%`,
                background: isTop3
                  ? `linear-gradient(90deg, ${mColor}cc, ${mColor}66)`
                  : 'linear-gradient(90deg, #3B82F6aa, #3B82F666)',
                boxShadow: isTop3 ? `0 0 8px ${mColor}60` : '0 0 6px rgba(59,130,246,0.4)',
              }}
            />
          </div>
        </div>

        {/* 점수 */}
        <div className="flex-shrink-0 text-right w-20 sm:w-36">
          <div className="flex items-baseline justify-end gap-2">
            <span
              className="text-xl font-black tabular-nums"
              style={{ color: isTop3 ? (mColor ?? '#E5E7EB') : '#E5E7EB',
                textShadow: isTop3 ? `0 0 10px ${mColor}80` : 'none' }}
            >
              {row.score}h
            </span>
          </div>
          <p className="hidden sm:block text-xs text-gray-600 mt-0.5">
            단순 {row.rawAvg}h
            <span className={`ml-1.5 font-semibold ${diffPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {diffPct >= 0 ? `+${diffPct}` : diffPct}%
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BattlePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records,  setRecords]  = useState<DailyRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'school' | 'grade'>('school');

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

  const elapsed = elapsedDays();

  // 학생별 일평균
  const studentAvgs = useMemo(() => {
    return students.map(s => {
      const total = Math.round(records.filter(r => r.student_id === s.id).reduce((a, r) => a + r.total_hours, 0) * 10) / 10;
      return { ...s, dailyAvg: Math.round((total / elapsed) * 10) / 10 };
    });
  }, [students, records, elapsed]);

  // 전체 평균
  const globalAvg = useMemo(() =>
    studentAvgs.length ? studentAvgs.reduce((a, s) => a + s.dailyAvg, 0) / studentAvgs.length : 0,
    [studentAvgs]);

  // 학교별 베이지안
  const schoolRanking = useMemo(() =>
    calcBayesian(
      SCHOOLS.map(school => ({
        label: school,
        avgs:  studentAvgs.filter(s => s.school === school).map(s => s.dailyAvg),
      })),
      globalAvg,
    ),
    [studentAvgs, globalAvg]);

  // 학년별 베이지안 — grade는 '고1','고2','고3','중3' 등 문자열
  const gradeRanking = useMemo(() => {
    const gradeSet = Array.from(new Set(studentAvgs.map(s => s.grade))).sort();
    return calcBayesian(
      gradeSet.map(g => ({
        label: g,
        avgs: studentAvgs.filter(s => s.grade === g).map(s => s.dailyAvg),
      })),
      globalAvg,
    );
  }, [studentAvgs, globalAvg]);

  const ranking    = tab === 'school' ? schoolRanking : gradeRanking;
  const maxScore   = ranking[0]?.score ?? 1;

  return (
    <div className="min-h-screen pb-20 md:pb-8" style={{ background: '#0a0a0f', color: '#E5E7EB' }}>
      {/* ── 헤더 ── */}
      <header className="px-6 pt-8 pb-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-xs font-bold tracking-[0.4em] text-blue-500 uppercase mb-1">SEASON 2</p>
        <h1 className="text-2xl font-black tracking-tight"
          style={{ textShadow: '0 0 20px rgba(96,165,250,0.5)' }}>
          대항전
        </h1>
        <p className="text-gray-600 text-sm mt-1">베이지안 보정 점수 기준 (수축강도 k=5)</p>
      </header>

      {/* ── 탭 ── */}
      <div className="px-3 sm:px-6 pt-5 pb-1 flex gap-2">
        {([['school', '🏫 학교별'], ['grade', '🎓 학년별']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all min-h-[36px]"
            style={tab === key ? {
              background: 'rgba(59,130,246,0.2)',
              color: '#60A5FA',
              border: '1px solid rgba(59,130,246,0.4)',
              boxShadow: '0 0 12px rgba(59,130,246,0.2)',
            } : {
              background: 'rgba(255,255,255,0.04)',
              color: '#6B7280',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 베이지안 설명 박스 ── */}
      <div className="mx-3 sm:mx-6 mt-4 px-3 sm:px-4 py-3 rounded-xl text-xs text-gray-600"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="text-gray-500 font-semibold">보정 공식: </span>
        보정점수 = (n / (n+{K})) × 그룹평균 + ({K} / (n+{K})) × 전체평균
        <span className="ml-2 text-gray-700">· 전체평균 {Math.round(globalAvg * 100) / 100}h</span>
      </div>

      {/* ── 랭킹 ── */}
      <main className="px-4 pt-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
              style={{ boxShadow: '0 0 12px #3B82F6' }} />
            <p className="text-gray-600 text-sm">계산 중...</p>
          </div>
        ) : (
          <>
            {/* 컬럼 헤더 */}
            <div className="grid text-xs font-bold uppercase tracking-wider text-gray-700 px-5 py-2 mb-1"
              style={{ gridTemplateColumns: '3rem 5rem 1fr 9rem' }}>
              <span className="text-center">순위</span>
              <span>{tab === 'school' ? '학교' : '학년'}</span>
              <span className="pl-2 hidden sm:block">분포</span>
              <span className="text-right">보정점수 / 단순평균</span>
            </div>

            <div className="space-y-2">
              {ranking.map((row, i) => (
                <BattleRow key={row.label} row={row} rank={i + 1} maxScore={maxScore} />
              ))}
            </div>

            {/* 참여 인원 요약 */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {ranking.map((row, i) => (
                <div key={row.label} className="text-center py-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-lg font-black" style={{ color: RANK_COLOR(i) }}>
                    {i < 3 ? MEDAL[i] : ''} {row.label}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{row.n}명 · {row.score}h</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
