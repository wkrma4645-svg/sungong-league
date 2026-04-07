import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — 특정 학생+날짜의 기록 존재 여부
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const student_id = searchParams.get('student_id');
  const record_date = searchParams.get('record_date');

  if (!student_id || !record_date) return Response.json({ exists: false });

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('daily_records')
    .select('total_hours')
    .eq('student_id', student_id)
    .eq('record_date', record_date)
    .maybeSingle();

  return Response.json({
    exists: !!data,
    total_hours: data?.total_hours ?? 0,
  });
}
