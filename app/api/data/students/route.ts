import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .neq('is_active', false)
    .order('school')
    .order('name');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}
