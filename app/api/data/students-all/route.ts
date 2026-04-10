import { createServiceClient } from '@/lib/supabase/service';
import { noCacheJson } from '@/lib/no-cache';

export const runtime = 'nodejs';
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('school')
    .order('name');
  if (error) return noCacheJson({ error: error.message }, { status: 500 });
  return noCacheJson(data ?? []);
}
