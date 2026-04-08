import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const revalidate = 0;
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
  return Response.json(data ?? [], { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Vercel-CDN-Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store' } });
}
