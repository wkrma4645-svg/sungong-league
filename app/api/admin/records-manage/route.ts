import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// PATCH — update record
export async function PATCH(request: NextRequest) {
  try {
    const { id, ...fields } = await request.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('daily_records').update(fields).eq('id', id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

// DELETE — delete record
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { error } = await supabase.from('daily_records').delete().eq('id', id);

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
