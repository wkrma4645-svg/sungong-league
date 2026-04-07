import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// GET — fetch single record by student_id + record_date
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const student_id = searchParams.get('student_id');
  const record_date = searchParams.get('record_date');

  if (!student_id || !record_date) {
    return Response.json(null);
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('daily_records')
    .select('*')
    .eq('student_id', student_id)
    .eq('record_date', record_date)
    .maybeSingle();

  return Response.json(data);
}

// POST — upsert daily record (manual entry)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { student_id, record_date, math, english, korean, science, social, etc } = body;

    if (!student_id || !record_date) {
      return Response.json({ error: '학생과 날짜를 선택해주세요.' }, { status: 400 });
    }

    const math_hours = math ?? 0;
    const english_hours = english ?? 0;
    const korean_hours = korean ?? 0;
    const science_hours = science ?? 0;
    const social_hours = social ?? 0;
    const etc_hours = etc ?? 0;
    const total_hours = math_hours + english_hours + korean_hours + science_hours + social_hours + etc_hours;

    const supabase = createServiceClient();

    const { error } = await supabase.from('daily_records').upsert(
      {
        student_id,
        record_date,
        math_hours,
        english_hours,
        korean_hours,
        science_hours,
        social_hours,
        etc_hours,
        input_method: 'manual',
      },
      { onConflict: 'student_id,record_date' },
    );

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, total_hours });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
