import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { noCacheJson } from '@/lib/no-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST — create student
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    const { data: season } = await supabase
      .from('seasons')
      .select('id')
      .eq('is_active', true)
      .single();

    const { data, error } = await supabase
      .from('students')
      .insert({ ...body, season_id: season?.id ?? null })
      .select()
      .single();

    if (error) return noCacheJson({ error: error.message }, { status: 500 });
    return noCacheJson({ success: true, student: data });
  } catch (e: unknown) {
    return noCacheJson({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

// PATCH — update student
export async function PATCH(request: NextRequest) {
  try {
    const { id, ...rest } = await request.json();
    if (!id) return noCacheJson({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('students').update(rest).eq('id', id);

    if (error) return noCacheJson({ error: error.message }, { status: 500 });
    return noCacheJson({ success: true });
  } catch (e: unknown) {
    return noCacheJson({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

// DELETE — delete student
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return noCacheJson({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('students').delete().eq('id', id);

    if (error) return noCacheJson({ error: error.message }, { status: 500 });
    return noCacheJson({ success: true });
  } catch (e: unknown) {
    return noCacheJson({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
