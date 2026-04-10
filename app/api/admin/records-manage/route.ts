import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { noCacheJson } from '@/lib/no-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PATCH — update record
export async function PATCH(request: NextRequest) {
  try {
    const { id, ...fields } = await request.json();
    if (!id) return noCacheJson({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('daily_records').update(fields).eq('id', id);

    if (error) return noCacheJson({ error: error.message }, { status: 500 });
    return noCacheJson({ success: true });
  } catch (e: unknown) {
    return noCacheJson({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

// DELETE — delete record
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return noCacheJson({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('daily_records').delete().eq('id', id);

    if (error) return noCacheJson({ error: error.message }, { status: 500 });
    return noCacheJson({ success: true });
  } catch (e: unknown) {
    return noCacheJson({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
