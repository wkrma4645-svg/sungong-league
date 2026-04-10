import { createServiceClient } from '@/lib/supabase/service';
import { noCacheJson } from '@/lib/no-cache';

export const runtime = 'nodejs';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('daily_records')
    .select('id, student_id, record_date, math_hours, english_hours, korean_hours, science_hours, social_hours, etc_hours, total_hours, input_method, verified');

  if (error) return noCacheJson({ error: error.message }, { status: 500 });
  return noCacheJson(data ?? []);
}
