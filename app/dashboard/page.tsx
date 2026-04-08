'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import GoalProgressBars from '@/components/GoalProgressBars';

// ─── Config ───────────────────────────────────────────────────────────────────

const SEASON_START      = '2026-03-16';
const SEASON_END        = '2026-06-30';
const SEASON_NAME       = 'SEASON 2';
const SEASON_TOTAL_DAYS = 107; // 2026-03-16 ~ 2026-06-30
const PAGE_SIZE         = 20;
const ROTATE_MS         = 15_000;

// ─── Tiers ────────────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'CHALLENGER',  emoji: '🔥', color: '#FF4655', glow: 'rgba(255,70,85,0.35)',   min: 8.0 },
  { name: 'GRANDMASTER', emoji: '👑', color: '#FF6B00', glow: 'rgba(255,107,0,0.35)',   min: 7.5 },
  { name: 'MASTER',      emoji: '💜', color: '#C084FC', glow: 'rgba(192,132,252,0.35)', min: 7.0 },
  { name: 'DIAMOND',     emoji: '💎', color: '#38BDF8', glow: 'rgba(56,189,248,0.35)',  min: 6.0 },
  { name: 'PLATINUM',    emoji: '🏆', color: '#2DD4BF', glow: 'rgba(45,212,191,0.3)',   min: 5.0 },
  { name: 'GOLD',        emoji: '🥇', color: '#FBBF24', glow: 'rgba(251,191,36,0.3)',   min: 4.0 },
  { name: 'SILVER',      emoji: '🥈', color: '#94A3B8', glow: 'rgba(148,163,184,0.25)', min: 3.0 },
  { name: 'BRONZE',      emoji: '🍂', color: '#D97706', glow: 'rgba(217,119,6,0.25)',   min: 2.0 },
  { name: 'IRON',        emoji: '⚙️',  color: '#78716C', glow: 'rgba(120,113,108,0.2)', min: 0   },
] as const;

type TierEntry = typeof TIERS[number];

function getTier(avg: number): TierEntry {
  return TIERS.find(t => avg >= t.min) ?? TIERS[TIERS.length - 1];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function kstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function elapsedDays(): number {
  const now   = kstNow();
  const start = new Date(SEASON_START);
  const diff  = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1); // inclusive
}

// ─── Types ────────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;
}

function kstToday(): string {
  const d = kstNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PlayerRow {
  student_id:    string;
  name:          string;
  school:        string;
  grade:         string;
  total_goal:    number;
  total:         number;
  daily_avg:     number;
  achievement:   number;  // 누적/총목표 × 100
  seasonProgress: number; // 학생별 첫참여일 기준
  dailyRequired: number;  // 목표 달성 위한 일일 필요시간
  rank:          number;
  rankDelta:     number | null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const supabase = createClient();

  const [rows,        setRows]        = useState<PlayerRow[]>([]);
  const [page,        setPage]        = useState(0);
  const [loading,     setLoading]     = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastUpdated, setLastUpdated] = useState('');
  const [clock, setClock] = useState('');
  const [flash,       setFlash]       = useState(false); // highlight on new data

  const prevRankRef  = useRef<Map<string, number>>(new Map());
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Build leaderboard ──────────────────────────────────────────────────────
  const buildRows = useCallback(async () => {
    const [studentsRaw, recordsRaw] = await Promise.all([
      fetch('/api/data/students').then(r => r.json()),
      fetch('/api/data/records').then(r => r.json()),
    ]);
    const students = Array.isArray(studentsRaw) ? studentsRaw : [];
    const records  = Array.isArray(recordsRaw)  ? recordsRaw  : [];
    if (students.length === 0) return;

    // 학생별 누적시간 + 첫참여일 계산
    const sumMap = new Map<string, number>();
    const firstDateMap = new Map<string, string>();
    for (const r of records) {
      sumMap.set(r.student_id, (sumMap.get(r.student_id) ?? 0) + (r.total_hours ?? 0));
      const prev = firstDateMap.get(r.student_id);
      if (!prev || r.record_date < prev) firstDateMap.set(r.student_id, r.record_date);
    }

    const today = kstToday();

    const sorted = students
      .map(s => {
        const total = Math.round((sumMap.get(s.id) ?? 0) * 10) / 10;
        const firstDate = firstDateMap.get(s.id) ?? today;
        const elapsed = Math.max(1, daysBetween(firstDate, today));
        const totalDays = Math.max(1, daysBetween(firstDate, SEASON_END));
        const remaining = Math.max(1, daysBetween(today, SEASON_END));
        const daily_avg = Math.round((total / elapsed) * 10) / 10;
        const total_goal = s.total_goal ?? 0;
        const achievement = total_goal > 0 ? Math.round((total / total_goal) * 1000) / 10 : 0;
        const seasonProgress = Math.round((elapsed / totalDays) * 1000) / 10;
        const dailyRequired = total_goal > 0
          ? Math.round(Math.max(0, (total_goal - total) / remaining) * 10) / 10
          : 0;
        return { student_id: s.id, name: s.name, school: s.school, grade: s.grade,
          total_goal, total, daily_avg, achievement, seasonProgress, dailyRequired };
      })
      .sort((a, b) => b.total - a.total)
      .map((s, i) => {
        const rank      = i + 1;
        const prevRank  = prevRankRef.current.get(s.student_id);
        const rankDelta = prevRank != null ? prevRank - rank : null;
        return { ...s, rank, rankDelta };
      });

    const newMap = new Map<string, number>();
    sorted.forEach(r => newMap.set(r.student_id, r.rank));
    prevRankRef.current = newMap;

    setRows(sorted);
    setLastUpdated(kstNow().toLocaleTimeString('ko-KR'));
    setLoading(false);

    // brief flash on update
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }, []);

  // ── Initial load ──
  useEffect(() => { buildRows(); }, [buildRows]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_records' }, buildRows)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [buildRows, supabase]);

  // ── 1초 실시간 시계 ──
  useEffect(() => {
    const tick = () => setClock(kstNow().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auto page rotation ──
  const numPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    rotateTimerRef.current = setInterval(() => setPage(p => (p + 1) % numPages), ROTATE_MS);
    return () => { if (rotateTimerRef.current) clearInterval(rotateTimerRef.current); };
  }, [numPages]);

  // ── Fullscreen ──
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // ── Derived ──
  const elapsed          = elapsedDays();
  const seasonProgress   = Math.round((elapsed / SEASON_TOTAL_DAYS) * 1000) / 10; // 소수 1자리
  const participantCount = rows.filter(r => r.total > 0).length;
  const pageRows         = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const MEDAL = ['🥇', '🥈', '🥉'];
  const MEDAL_COLOR = ['#FFD700', '#C0C0C0', '#CD7F32'];

  // ── Loading / Empty ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0a0a0f' }}>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"
            style={{ boxShadow: '0 0 20px #3B82F6' }} />
          <p className="text-blue-400 text-lg tracking-widest">LOADING...</p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: '#0a0a0f' }}>
        <p className="text-4xl">📋</p>
        <p className="text-gray-500 text-lg">아직 제출된 기록이 없습니다</p>
        <p className="text-gray-700 text-sm">학생들이 기록을 제출하면 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen md:h-screen flex flex-col md:overflow-hidden select-none"
      style={{ background: '#0a0a0f', color: '#E5E7EB' }}
    >
      {/* ── Progress bar (rotation timer) ── */}
      <div className="h-0.5 w-full bg-gray-900 overflow-hidden flex-shrink-0">
        <div
          key={`${page}-progress`}
          className="h-full bg-blue-600"
          style={{
            animation: `growWidth ${ROTATE_MS}ms linear forwards`,
            boxShadow: '0 0 6px #3B82F6',
          }}
        />
      </div>
      <style>{`
        @keyframes growWidth { from { width: 0% } to { width: 100% } }
        @keyframes flashIn   { 0%,100% { opacity:1 } 50% { opacity:.6 } }
      `}</style>

      {/* ── Header ── */}
      <header
        className="flex-shrink-0 px-3 md:px-8 py-2 md:py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(30,40,80,0.4) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(59,130,246,0.15)',
          animation: flash ? 'flashIn 0.6s ease' : 'none',
        }}
      >
        {/* Mobile header — 1줄 */}
        <div className="md:hidden flex items-center justify-between whitespace-nowrap overflow-hidden">
          <span className="font-black shrink-0" style={{ fontSize: '14px', textShadow: '0 0 12px rgba(96,165,250,0.8)' }}>
            매플 순공리그
          </span>
          <div className="flex items-center gap-1.5 shrink-0" style={{ fontSize: '12px', color: '#60A5FA' }}>
            <span className="font-bold tabular-nums">D{elapsed}</span>
            <span className="text-gray-600">|</span>
            <span className="font-bold tabular-nums">{seasonProgress}%</span>
            <span className="text-gray-600">|</span>
            <span className="font-bold tabular-nums">{participantCount}명</span>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <div className="w-1.5 h-5 rounded-full bg-blue-400" style={{ boxShadow: '0 0 10px #60A5FA' }} />
              <div className="w-1.5 h-5 rounded-full bg-blue-600" style={{ boxShadow: '0 0 10px #2563EB' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-[0.2em] leading-tight" style={{ textShadow: '0 0 20px rgba(96,165,250,0.8)' }}>매플 순공리그</h1>
              <p className="text-xs font-bold tracking-[0.5em] text-blue-500 mt-0.5">{SEASON_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <Stat value={`Day ${elapsed}`} label="경과일" accent />
            <Divider />
            <Stat value={`${seasonProgress}%`} label="시즌진행률" accent />
            <Divider />
            <Stat value={`${participantCount}명`} label="참가인원" accent />
            <Divider />
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-xl font-black leading-tight tabular-nums font-mono" style={{ color: '#60A5FA', textShadow: '0 0 12px rgba(96,165,250,0.6)' }}>{clock}</p>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ boxShadow: '0 0 6px #22C55E' }} />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-0.5">현재시각</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="px-3 py-1.5 rounded-md border border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-600 text-xs">🏠 홈</Link>
            <button onClick={toggleFullscreen} className="px-3 py-1.5 rounded-md border border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-600 text-xs">⛶ 전체화면</button>
          </div>
        </div>
      </header>

      {/* ── Column headers ── */}
      <div className="flex-shrink-0 px-3 md:px-8 py-1 md:py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {/* Mobile — 4열 고정폭 */}
        <div className="md:hidden flex items-center text-gray-600 font-bold uppercase" style={{ fontSize: '10px' }}>
          <span className="text-center" style={{ width: '36px' }}>#</span>
          <span className="pl-1 flex-1">이름</span>
          <span className="text-right" style={{ width: '50px' }}>누적</span>
          <span className="text-center" style={{ width: '65px' }}>티어</span>
        </div>
        {/* Desktop */}
        <div className="hidden md:grid text-xs font-bold uppercase tracking-widest text-gray-600"
          style={{ gridTemplateColumns: '3rem 1.2fr 5rem 3rem 5rem 5rem 5rem 5rem 12rem 9rem' }}>
          <span className="text-center">순위</span>
          <span className="pl-2">이름</span>
          <span>학교</span>
          <span className="text-center">학년</span>
          <span className="text-right pr-2">누적</span>
          <span className="text-right pr-2">총목표</span>
          <span className="text-right pr-2">일평균</span>
          <span className="text-right pr-2">필요/일</span>
          <span className="text-center">티어</span>
          <span className="text-right">목표달성</span>
        </div>
      </div>

      {/* ── Rows ── */}
      <div className="flex-1 overflow-y-auto md:overflow-hidden px-3 md:px-8 py-1 md:py-2 flex flex-col gap-0.5 md:gap-1">
        {pageRows.map((row) => {
          const tier   = getTier(row.daily_avg);
          const isTop3 = row.rank <= 3;
          const mColor = isTop3 ? MEDAL_COLOR[row.rank - 1] : null;
          const rowBg = isTop3
            ? `linear-gradient(120deg, ${mColor}18 0%, ${tier.color}0a 60%, rgba(10,10,20,0.9) 100%)`
            : `linear-gradient(120deg, ${tier.color}0a 0%, rgba(10,10,20,0.95) 100%)`;
          const rowBorder = `1px solid ${isTop3 ? mColor + '35' : tier.color + '18'}`;

          return (
            <div key={row.student_id} className="md:flex-[1_1_0] md:min-h-0">
              {/* Mobile row */}
              <div className="md:hidden flex items-center rounded-lg px-2 py-2 overflow-hidden"
                style={{ fontSize: '13px', background: rowBg, border: rowBorder }}>
                <div style={{ width: '32px', flexShrink: 0, textAlign: 'center' }}>
                  {isTop3 ? <span style={{ fontSize: '16px', filter: `drop-shadow(0 0 4px ${mColor})` }}>{MEDAL[row.rank - 1]}</span>
                    : <span style={{ color: '#6B7280', fontSize: '12px', fontWeight: 700 }}>{row.rank}</span>}
                </div>
                <div style={{ flex: '1 1 0', minWidth: 0, paddingLeft: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  <span style={{ fontWeight: 700, color: isTop3 ? '#FFF' : '#D1D5DB' }}>{row.name}</span>
                </div>
                <div style={{ width: '48px', flexShrink: 0, textAlign: 'right', color: '#D1D5DB', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {row.total}
                </div>
                <div style={{ width: '60px', flexShrink: 0, textAlign: 'center' }}>
                  <span style={{ color: tier.color, fontSize: '10px', fontWeight: 900, whiteSpace: 'nowrap' }}>{tier.emoji}{tier.name.slice(0,4)}</span>
                </div>
              </div>

              {/* Desktop row */}
              <div className="hidden md:grid items-center rounded-lg px-3 h-full transition-all duration-500"
                style={{ gridTemplateColumns: '3rem 1.2fr 5rem 3rem 5rem 5rem 5rem 5rem 12rem 9rem', background: rowBg, border: rowBorder,
                  boxShadow: isTop3 ? `0 0 24px ${mColor}18, inset 0 0 30px ${tier.color}0a` : `inset 0 0 12px ${tier.color}06` }}>
                <div className="flex justify-center items-center">
                  {isTop3 ? <span className="text-xl font-black" style={{ filter: `drop-shadow(0 0 6px ${mColor})` }}>{MEDAL[row.rank - 1]}</span>
                    : <span className="text-base font-bold tabular-nums" style={{ color: '#6B7280' }}>{row.rank}</span>}
                </div>
                <div className="flex items-center gap-2 pl-2">
                  <span className="font-bold text-base leading-none" style={{ color: isTop3 ? '#FFFFFF' : '#D1D5DB', textShadow: isTop3 ? `0 0 10px ${mColor}80` : 'none' }}>{row.name}</span>
                  {row.rankDelta !== null && row.rankDelta !== 0 && (
                    <span className="text-[10px] font-black px-1 py-0.5 rounded" style={{ color: row.rankDelta > 0 ? '#34D399' : '#F87171', background: row.rankDelta > 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }}>
                      {row.rankDelta > 0 ? `▲${row.rankDelta}` : `▼${Math.abs(row.rankDelta)}`}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">{row.school}</span>
                <span className="text-center text-sm text-gray-600">{row.grade}</span>
                <span className="text-right pr-2 font-semibold text-gray-300 tabular-nums text-sm">{row.total}</span>
                <span className="text-right pr-2 text-gray-600 tabular-nums text-sm">{row.total_goal > 0 ? row.total_goal : '—'}</span>
                <span className="text-right pr-2 font-black tabular-nums text-base leading-none" style={{ color: tier.color, textShadow: `0 0 10px ${tier.glow}` }}>{row.daily_avg}</span>
                <span className="text-right pr-2 font-semibold tabular-nums text-sm" style={{ color: row.dailyRequired > row.daily_avg ? '#F87171' : '#34D399' }}>{row.total_goal > 0 ? `${row.dailyRequired}` : '—'}</span>
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-wider whitespace-nowrap"
                    style={{ color: tier.color, background: tier.glow, border: `1px solid ${tier.color}35`, boxShadow: `0 0 10px ${tier.glow}`, textShadow: `0 0 6px ${tier.color}` }}>
                    {tier.emoji} {tier.name}
                  </span>
                </div>
                <div className="px-1">
                  {row.total_goal > 0 ? (
                    <GoalProgressBars compact seasonProgress={row.seasonProgress} achievement={row.achievement} totalGoal={row.total_goal} accumulated={row.total} />
                  ) : <span className="text-[10px] text-gray-600">미설정</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <footer
        className="flex-shrink-0 px-3 md:px-8 py-1.5 md:py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-1.5 md:gap-2">
          {Array.from({ length: numPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)}
              style={{ width: i === page ? '20px' : '6px', height: '6px', borderRadius: '3px',
                background: i === page ? '#3B82F6' : '#1F2937', boxShadow: i === page ? '0 0 8px #3B82F6' : 'none',
                border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} />
          ))}
          <span className="ml-1 md:ml-3 text-[10px] md:text-xs text-gray-700 tabular-nums">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} / {rows.length}명
          </span>
        </div>
        <span className="hidden md:block text-[10px] font-bold tracking-[0.4em] text-gray-800 uppercase">
          Maple Study League · Realtime Leaderboard
        </span>
        <div className="grid grid-cols-3 md:flex md:items-center gap-x-3 gap-y-0.5 md:gap-3">
          {TIERS.slice(0, 6).map(t => (
            <span key={t.name} className="text-[9px] md:text-[10px] font-bold whitespace-nowrap" style={{ color: t.color, textShadow: `0 0 6px ${t.glow}` }}>
              {t.emoji}{t.min}h+
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p
        className="text-xl font-black leading-tight tabular-nums"
        style={accent ? { color: '#60A5FA', textShadow: '0 0 12px rgba(96,165,250,0.6)' } : { color: '#D1D5DB' }}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-0.5">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-8 bg-gray-800" />;
}
