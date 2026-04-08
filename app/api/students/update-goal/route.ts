import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST — 학생이 직접 총목표 설정/상향
export async function POST(request: NextRequest) {
  try {
    const { student_id, total_goal } = await request.json();
    if (!student_id || !total_goal || total_goal <= 0) {
      return Response.json({ error: '올바른 목표를 입력해주세요.' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 현재 학생 조회
    const { data: student } = await supabase
      .from('students')
      .select('total_goal, goal_edit_count')
      .eq('id', student_id)
      .single();

    if (!student) {
      return Response.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    const editCount = student.goal_edit_count ?? 0;

    // 수정 횟수 체크
    if (editCount >= 2) {
      return Response.json({ error: '목표 수정은 최대 2회까지만 가능합니다. 선생님께 문의하세요.' }, { status: 403 });
    }

    // 1회 이상 수정한 경우 상향만 가능
    if (editCount >= 1 && total_goal <= (student.total_goal ?? 0)) {
      return Response.json({ error: '기존 목표보다 높은 값으로만 변경할 수 있습니다.' }, { status: 400 });
    }

    // 업데이트
    const { error } = await supabase
      .from('students')
      .update({
        total_goal,
        goal_edit_count: editCount + 1,
      })
      .eq('id', student_id);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      success: true,
      total_goal,
      goal_edit_count: editCount + 1,
    });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
