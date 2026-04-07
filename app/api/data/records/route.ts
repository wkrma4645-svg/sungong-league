import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/data/records
export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('daily_records')
    .select('id, student_id, record_date, math_hours, english_hours, korean_hours, science_hours, social_hours, etc_hours, total_hours, input_method, verified');

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}
