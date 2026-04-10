import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { noCacheJson } from '@/lib/no-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET — 미확인 수동기록 목록
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('daily_records')
    .select('id, student_id, record_date, math_hours, english_hours, korean_hours, science_hours, social_hours, etc_hours, total_hours, input_method, verified')
    .eq('input_method', 'manual_student')
    .order('record_date', { ascending: false })
    .range(0, 9999);

  if (error) return noCacheJson({ error: error.message }, { status: 500 });
  return noCacheJson(data ?? []);
}

// PATCH — 확인완료 처리
export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return noCacheJson({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('daily_records')
      .update({ verified: true })
      .eq('id', id);

    if (error) return noCacheJson({ error: error.message }, { status: 500 });
    return noCacheJson({ success: true });
  } catch (e: unknown) {
    return noCacheJson({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
