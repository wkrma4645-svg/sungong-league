import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

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
    .order('record_date', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? [], { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Vercel-CDN-Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } });
}

// PATCH — 확인완료 처리
export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('daily_records')
      .update({ verified: true })
      .eq('id', id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
