import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date, data_start_date')
    .eq('is_active', true)
    .single();
  return Response.json(data);
}
