import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns ALL students including deactivated ones (for admin management tab)
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('school')
    .order('name');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}
