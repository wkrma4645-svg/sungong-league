'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  teacher:       string;
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
      fetch('/api/data/students', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/data/records', { cache: 'no-store' }).then(r => r.json()),
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
        return { student_id: s.id, name: s.name, school: s.school, grade: s.grade, teacher: s.teacher ?? '',
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

  // ── Auto slide rotation ──
  // slide 0: Landing, slide 1..N: leaderboard pages, slide N+1: tier status
  const leaderboardPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const totalSlides = 1 + leaderboardPages + 1; // landing + pages + tier
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay) { if (rotateTimerRef.current) clearInterval(rotateTimerRef.current); return; }
    rotateTimerRef.current = setInterval(() => setPage(p => (p + 1) % totalSlides), ROTATE_MS);
    return () => { if (rotateTimerRef.current) clearInterval(rotateTimerRef.current); };
  }, [totalSlides, autoPlay]);

  const goSlide = (n: number) => {
    setPage(n);
    if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    if (autoPlay) rotateTimerRef.current = setInterval(() => setPage(p => (p + 1) % totalSlides), ROTATE_MS);
  };

  // ── Fullscreen ──
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // ── Derived ──
  const elapsed          = elapsedDays();
  const seasonProgress   = Math.round((elapsed / SEASON_TOTAL_DAYS) * 1000) / 10;
  const participantCount = rows.filter(r => r.total > 0).length;
  const isLanding     = page === 0;
  const isTierSlide   = page === totalSlides - 1;
  const leaderboardIdx = page - 1; // 0-based within leaderboard
  const pageRows       = (!isLanding && !isTierSlide) ? rows.slice(leaderboardIdx * PAGE_SIZE, (leaderboardIdx + 1) * PAGE_SIZE) : [];

  // ── Tier calculations for tier slide ──
  const tierData = useMemo(() => {
    // 상위 티어 학생들
    const upperTiers = TIERS.filter(t => t.min >= 6.0);
    const upperGroups = upperTiers.map(tier => ({
      tier,
      students: rows.filter(r => {
        const t = getTier(r.daily_avg);
        return t.name === tier.name;
      }),
    }));

    // 티어 변동: 어제 vs 오늘
    // 어제 일평균 = (total - 오늘 기록) / (elapsed - 1)
    const risers: { name: string; from: TierEntry; to: TierEntry }[] = [];
    const fallers: { name: string; from: TierEntry; to: TierEntry }[] = [];
    for (const r of rows) {
      if (elapsed <= 1) continue;
      const todayAvg = r.daily_avg;
      // 어제까지 일평균 근사: total / elapsed 가 오늘이니, (total - todayRecord) / (elapsed-1)
      // todayRecord를 정확히 모르니까, yesterday_avg = total / (elapsed - 1) vs today_avg = total / elapsed 로 근사
      const yesterdayAvg = r.total > 0 ? Math.round((r.total / (elapsed - 1)) * 10) / 10 : 0;
      const tierToday = getTier(todayAvg);
      const tierYesterday = getTier(yesterdayAvg);
      if (TIERS.indexOf(tierToday) < TIERS.indexOf(tierYesterday)) {
        risers.push({ name: r.name, from: tierYesterday, to: tierToday });
      } else if (TIERS.indexOf(tierToday) > TIERS.indexOf(tierYesterday)) {
        fallers.push({ name: r.name, from: tierYesterday, to: tierToday });
      }
    }
    return { upperGroups, risers, fallers };
  }, [rows, elapsed]);

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

  // ── 모바일 전용 렌더 ──
  const mobileView = (
    <div className="md:hidden min-h-screen pb-20" style={{ background: '#0a0a0f', color: '#E5E7EB' }}>
      {/* 모바일 헤더 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-base opacity-40 hover:opacity-80 transition-opacity">🏠</Link>
          <div>
            <p className="text-sm font-black" style={{ color: '#60A5FA' }}>매플 순공리그</p>
            <p className="text-[10px] text-gray-600">{SEASON_NAME}</p>
          </div>
        </div>
        <div className="flex gap-3 text-xs font-bold tabular-nums" style={{ color: '#60A5FA' }}>
          <span>D{elapsed}</span>
          <span>{seasonProgress}%</span>
          <span>{participantCount}명</span>
        </div>
      </div>

      {/* 모바일 리스트 */}
      <div className="px-2 py-2 space-y-1">
        {rows.map((row) => {
          const tier = getTier(row.daily_avg);
          const isTop3 = row.rank <= 3;
          const mColor = isTop3 ? MEDAL_COLOR[row.rank - 1] : null;
          return (
            <div key={row.student_id}
              className="flex items-center rounded-lg px-3 py-2.5"
              style={{
                background: isTop3
                  ? `linear-gradient(120deg, ${mColor}20 0%, rgba(10,10,20,0.95) 100%)`
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isTop3 ? mColor + '40' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {/* 순위 */}
              <div className="w-8 shrink-0 text-center">
                {isTop3
                  ? <span className="text-lg">{MEDAL[row.rank - 1]}</span>
                  : <span className="text-sm font-bold" style={{ color: '#6B7280' }}>{row.rank}</span>}
              </div>
              {/* 이름 + 학교 */}
              <div className="flex-1 min-w-0 ml-2">
                <p className="text-sm font-bold truncate" style={{ color: isTop3 ? '#FFF' : '#D1D5DB' }}>{row.name}</p>
                <p className="text-[10px] text-gray-600 truncate">{row.school} {row.grade}</p>
              </div>
              {/* 누적 */}
              <div className="w-14 shrink-0 text-right mr-2">
                <p className="text-sm font-bold text-gray-200 tabular-nums">{row.total}h</p>
                <p className="text-[10px] text-gray-600 tabular-nums">{row.daily_avg}/일</p>
              </div>
              {/* 티어 */}
              <div className="w-12 shrink-0 text-center">
                <p className="text-base leading-none">{tier.emoji}</p>
                <p className="text-[8px] font-black mt-0.5" style={{ color: tier.color }}>{tier.name.length > 6 ? tier.name.slice(0,4) : tier.name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 데스크탑(TV) 전용 렌더 ──
  return (
    <>
    {mobileView}
    <div
      className="hidden md:flex h-screen flex-col overflow-hidden select-none"
      style={{ background: '#0a0a0f', color: '#E5E7EB' }}
    >
      {/* ── Progress bar ── */}
      <div className="w-full bg-gray-900 overflow-hidden flex-shrink-0" style={{ height: autoPlay ? '6px' : '2px' }}>
        <div
          key={`${page}-progress`}
          className="h-full"
          style={{
            animation: autoPlay ? `growWidth ${ROTATE_MS}ms linear forwards` : 'none',
            width: autoPlay ? undefined : '100%',
            background: 'linear-gradient(90deg, #22D3EE, #3B82F6, #8B5CF6)',
            boxShadow: '0 0 10px #22D3EE',
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

      {/* ── SLIDE: Landing ── */}
      {isLanding && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
          <p className="text-4xl md:text-5xl font-black text-center leading-tight mb-8"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FF4655, #FF6B00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              textShadow: 'none', filter: 'drop-shadow(0 0 30px rgba(255,70,85,0.4))' }}>
            상금 100만원의 주인공은<br/>누가 될 것인가?
          </p>
          <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
            {/* 시즌 시상 */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <h3 className="text-sm font-black tracking-widest text-center mb-4" style={{ color: '#FFD700' }}>🏆 시즌 시상 (분기)</h3>
              <div className="space-y-2">
                {[
                  ['순공왕', '누적 순공 1위', '30만원'],
                  ['철인상', '최다 연속 인증', '20만원'],
                  ['점프왕', '티어 최대 상승', '15만원'],
                  ['루키상', '첫 참가 최고 성적', '10만원'],
                  ['스프린트', '월간 1위', '5만원/월'],
                  ['퍼펙트', '100% 인증', '3만원'],
                ].map(([n, d, p]) => (
                  <div key={n} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,215,0,0.05)' }}>
                    <div><span className="text-sm font-bold text-gray-200">{n}</span><span className="text-xs text-gray-500 ml-2">{d}</span></div>
                    <span className="text-sm font-black" style={{ color: '#FFD700' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 연말 시상 */}
            <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,70,85,0.15)' }}>
              <h3 className="text-sm font-black tracking-widest text-center mb-4" style={{ color: '#FF4655' }}>🎖 연말 시상식 (12월)</h3>
              <div className="space-y-2">
                {[
                  ['연간 MVP', '4시즌 누적 1위', '100만원'],
                  ['올해의 루키', '첫 참가 최고 성장', '30만원'],
                  ['명예의 전당', '연간 챌린저 유지', '네임플레이트'],
                ].map(([n, d, p]) => (
                  <div key={n} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,70,85,0.05)' }}>
                    <div><span className="text-sm font-bold text-gray-200">{n}</span><span className="text-xs text-gray-500 ml-2">{d}</span></div>
                    <span className="text-sm font-black" style={{ color: '#FF4655' }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SLIDE: Tier Status ── */}
      {isTierSlide && (
        <div className="flex-1 flex flex-col px-8 py-4 overflow-hidden">
          <h2 className="text-lg font-black tracking-widest text-center mb-4" style={{ color: '#60A5FA' }}>일일 티어 현황</h2>
          <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
            {/* ① 상위 티어 */}
            <div className="rounded-xl p-4 overflow-y-auto" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-xs font-bold tracking-widest text-gray-500 mb-3">상위 티어 현황</h3>
              {tierData.upperGroups.map(({ tier, students: ss }) => (
                <div key={tier.name} className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{tier.emoji}</span>
                    <span className="text-sm font-black" style={{ color: tier.color }}>{tier.name}</span>
                    <span className="text-xs text-gray-600">{ss.length}명</span>
                  </div>
                  {ss.length === 0 ? (
                    <p className="text-xs text-gray-700 pl-8">해당자 없음</p>
                  ) : ss.map(s => (
                    <div key={s.student_id} className="flex justify-between pl-8 py-0.5">
                      <span className="text-sm text-gray-300">{s.name}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: tier.color }}>{s.daily_avg}h</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* ② 상승자 */}
            <div className="rounded-xl p-4 overflow-y-auto" style={{ background: 'rgba(52,211,153,0.03)', border: '1px solid rgba(52,211,153,0.15)' }}>
              <h3 className="text-xs font-bold tracking-widest mb-3" style={{ color: '#34D399' }}>🔺 금일 티어 상승자</h3>
              {tierData.risers.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">오늘 상승자 없음</p>
              ) : tierData.risers.map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                  <span className="text-sm font-bold text-gray-200">{r.name}</span>
                  <span className="text-xs font-bold" style={{ color: r.from.color }}>{r.from.emoji}{r.from.name}</span>
                  <span className="text-green-400">→</span>
                  <span className="text-xs font-bold" style={{ color: r.to.color }}>{r.to.emoji}{r.to.name}</span>
                </div>
              ))}
            </div>
            {/* ③ 하락자 */}
            <div className="rounded-xl p-4 overflow-y-auto" style={{ background: 'rgba(248,113,113,0.03)', border: '1px solid rgba(248,113,113,0.15)' }}>
              <h3 className="text-xs font-bold tracking-widest mb-3" style={{ color: '#F87171' }}>🔻 금일 티어 하락자</h3>
              {tierData.fallers.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">오늘 하락자 없음</p>
              ) : tierData.fallers.map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                  <span className="text-sm font-bold text-gray-200">{r.name}</span>
                  <span className="text-xs font-bold" style={{ color: r.from.color }}>{r.from.emoji}{r.from.name}</span>
                  <span className="text-red-400">→</span>
                  <span className="text-xs font-bold" style={{ color: r.to.color }}>{r.to.emoji}{r.to.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SLIDE: Leaderboard ── */}
      {!isLanding && !isTierSlide && (<>
      {/* ── Column headers ── */}
      <div className="flex-shrink-0 px-8 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="grid text-xs font-bold uppercase tracking-widest text-gray-600"
          style={{ gridTemplateColumns: '3rem 1.2fr 5rem 3rem 4rem 5rem 5rem 5rem 5rem 12rem 9rem' }}>
          <span className="text-center">순위</span>
          <span className="pl-2">이름</span>
          <span>학교</span>
          <span className="text-center">학년</span>
          <span>담당</span>
          <span className="text-right pr-2">누적</span>
          <span className="text-right pr-2">총목표</span>
          <span className="text-right pr-2">일평균</span>
          <span className="text-right pr-2">필요/일</span>
          <span className="text-center">티어</span>
          <span className="text-right">목표달성</span>
        </div>
      </div>

      {/* ── Rows ── */}
      <div className="flex-1 overflow-hidden px-8 py-2 flex flex-col gap-1">
        {pageRows.map((row) => {
          const tier   = getTier(row.daily_avg);
          const isTop3 = row.rank <= 3;
          const mColor = isTop3 ? MEDAL_COLOR[row.rank - 1] : null;
          const rowBg = isTop3
            ? `linear-gradient(120deg, ${mColor}18 0%, ${tier.color}0a 60%, rgba(10,10,20,0.9) 100%)`
            : `linear-gradient(120deg, ${tier.color}0a 0%, rgba(10,10,20,0.95) 100%)`;
          const rowBorder = `1px solid ${isTop3 ? mColor + '35' : tier.color + '18'}`;

          return (
            <div key={row.student_id} style={{ flex: '1 1 0', minHeight: 0 }}>
              <div className="grid items-center rounded-lg px-3 h-full transition-all duration-500"
                style={{ gridTemplateColumns: '3rem 1.2fr 5rem 3rem 4rem 5rem 5rem 5rem 5rem 12rem 9rem', background: rowBg, border: rowBorder,
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
                <span className="text-xs text-gray-600 truncate">{row.teacher}</span>
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

      </>)}

      {/* ── Footer ── */}
      <footer
        className="flex-shrink-0 px-8 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* 좌: ◀ + 페이지 dots + ▶ */}
        <div className="flex items-center gap-2">
          <button onClick={() => goSlide((page - 1 + totalSlides) % totalSlides)}
            className="text-gray-600 hover:text-gray-300 text-lg px-1">◀</button>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button key={i} onClick={() => goSlide(i)}
              style={{ width: i === page ? '20px' : '6px', height: '6px', borderRadius: '3px',
                background: i === page ? '#22D3EE' : '#1F2937', boxShadow: i === page ? '0 0 8px #22D3EE' : 'none',
                border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} />
          ))}
          <button onClick={() => goSlide((page + 1) % totalSlides)}
            className="text-gray-600 hover:text-gray-300 text-lg px-1">▶</button>
          <span className="ml-2 text-xs text-gray-700 tabular-nums">
            {isLanding ? '🏠' : isTierSlide ? '티어' : `${leaderboardIdx * PAGE_SIZE + 1}–${Math.min((leaderboardIdx + 1) * PAGE_SIZE, rows.length)} / ${rows.length}명`}
          </span>
        </div>
        {/* 중: 자동전환 토글 */}
        <div className="flex items-center gap-4">
          <button onClick={() => setAutoPlay(p => !p)}
            className="text-xs px-3 py-1 rounded-full border transition-colors"
            style={{ borderColor: autoPlay ? '#22D3EE' : '#374151', color: autoPlay ? '#22D3EE' : '#6B7280' }}>
            {autoPlay ? '▶ AUTO' : '⏸ STOP'}
          </button>
          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-800 uppercase">Maple Study League</span>
        </div>
        {/* 우: 티어 범례 */}
        <div className="flex items-center gap-3">
          {TIERS.slice(0, 5).map(t => (
            <span key={t.name} className="text-[10px] font-bold" style={{ color: t.color, textShadow: `0 0 6px ${t.glow}` }}>
              {t.emoji}{t.min}h+
            </span>
          ))}
        </div>
      </footer>
    </div>
    </>
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
