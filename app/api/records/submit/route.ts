import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { noCacheJson } from '@/lib/no-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SEASON_END = '2026-06-30';

const TIERS = [
  { name: 'CHALLENGER',  emoji: '🔥', color: '#FF4655', min: 8.0 },
  { name: 'GRANDMASTER', emoji: '👑', color: '#FF6B00', min: 7.5 },
  { name: 'MASTER',      emoji: '💜', color: '#C084FC', min: 7.0 },
  { name: 'DIAMOND',     emoji: '💎', color: '#38BDF8', min: 6.0 },
  { name: 'PLATINUM',    emoji: '🏆', color: '#2DD4BF', min: 5.0 },
  { name: 'GOLD',        emoji: '🥇', color: '#FBBF24', min: 4.0 },
  { name: 'SILVER',      emoji: '🥈', color: '#94A3B8', min: 3.0 },
  { name: 'BRONZE',      emoji: '🍂', color: '#D97706', min: 2.0 },
  { name: 'IRON',        emoji: '⚙️',  color: '#78716C', min: 0   },
];

function kstToday(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;
}

export async function POST(request: NextRequest) {
  try {
    const { student_id, record_date, math, english, korean, science, social, etc, input_method } =
      await request.json();

    if (!student_id || !record_date) {
      return noCacheJson({ error: '학생과 날짜를 선택해주세요.' }, { status: 400 });
    }

    const math_hours    = math    ?? 0;
    const english_hours = english ?? 0;
    const korean_hours  = korean  ?? 0;
    const science_hours = science ?? 0;
    const social_hours  = social  ?? 0;
    const etc_hours     = etc     ?? 0;
    const total_hours   = math_hours + english_hours + korean_hours + science_hours + social_hours + etc_hours;

    const supabase = createServiceClient();
    const method = input_method ?? 'manual';
    const isStudentSubmit = method === 'screenshot' || method === 'manual_student';

    // 학생 제출: 하루 1회 제한 (관리자 입력은 덮어쓰기 허용)
    if (isStudentSubmit) {
      const { data: existing } = await supabase
        .from('daily_records')
        .select('id')
        .eq('student_id', student_id)
        .eq('record_date', record_date)
        .maybeSingle();
      if (existing) {
        return noCacheJson({ error: '오늘은 이미 기록을 제출했습니다. 수정이 필요하면 선생님께 말씀해주세요.' }, { status: 409 });
      }
    }

    // upsert (관리자) 또는 insert (학생)
    const verified = !isStudentSubmit;
    const recordData = {
      student_id, record_date,
      math_hours, english_hours, korean_hours, science_hours, social_hours, etc_hours,
      input_method: method,
      verified,
    };

    const { error } = isStudentSubmit
      ? await supabase.from('daily_records').insert(recordData)
      : await supabase.from('daily_records').upsert(recordData, { onConflict: 'student_id,record_date' });

    if (error) throw error;

    // 전체 레코드 + 학생 정보 조회
    const [{ data: records }, { data: studentRow }] = await Promise.all([
      supabase.from('daily_records').select('student_id, record_date, total_hours'),
      supabase.from('students').select('total_goal').eq('id', student_id).single(),
    ]);

    // 학생별 누적 + 첫참여일
    const today = kstToday();
    const sumMap = new Map<string, number>();
    const firstDateMap = new Map<string, string>();
    for (const r of records ?? []) {
      sumMap.set(r.student_id, (sumMap.get(r.student_id) ?? 0) + (r.total_hours ?? 0));
      const prev = firstDateMap.get(r.student_id);
      if (!prev || r.record_date < prev) firstDateMap.set(r.student_id, r.record_date);
    }

    // 일평균 기반 순위 (첫참여일 ~ 오늘)
    const sorted = Array.from(sumMap.entries())
      .map(([id, sum]) => {
        const firstDate = firstDateMap.get(id) ?? today;
        const elapsed = Math.max(1, daysBetween(firstDate, today));
        return { id, sum, avg: sum / elapsed };
      })
      .sort((a, b) => b.sum - a.sum);

    const rank = sorted.findIndex((s) => s.id === student_id) + 1;
    const mySum = sumMap.get(student_id) ?? total_hours;
    const myFirstDate = firstDateMap.get(student_id) ?? today;
    const myElapsed = Math.max(1, daysBetween(myFirstDate, today));
    const dailyAvg = mySum / myElapsed;

    // 티어
    const tierRow = TIERS.find((t) => dailyAvg >= t.min) ?? TIERS[TIERS.length - 1];

    // 목표 계산
    const total_goal = studentRow?.total_goal ?? 0;
    const totalDays = Math.max(1, daysBetween(myFirstDate, SEASON_END));
    const achievement = total_goal > 0 ? Math.round((mySum / total_goal) * 1000) / 10 : 0;
    const season_progress = Math.round((myElapsed / totalDays) * 1000) / 10;
    const remaining = Math.max(1, daysBetween(today, SEASON_END));
    const daily_required = total_goal > 0
      ? Math.round(Math.max(0, (total_goal - mySum) / remaining) * 10) / 10
      : 0;

    return noCacheJson({
      success: true,
      total: total_hours,
      accumulated: Math.round(mySum * 10) / 10,
      rank,
      total_students: sorted.length,
      daily_avg: Math.round(dailyAvg * 10) / 10,
      achievement,
      season_progress,
      total_goal,
      daily_required,
      tier: { name: tierRow.name, color: tierRow.color, emoji: tierRow.emoji },
    });
  } catch (e: unknown) {
    console.error(e);
    return noCacheJson({ error: e instanceof Error ? e.message : '제출에 실패했습니다.' }, { status: 500 });
  }
}
