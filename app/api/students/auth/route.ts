import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// POST — 학생 로그인 or PIN 설정
export async function POST(request: NextRequest) {
  try {
    const { action, name, pin, student_id } = await request.json();
    const supabase = createServiceClient();

    // 이름으로 학생 검색
    if (action === 'search') {
      const { data } = await supabase
        .from('students')
        .select('id, name, school, grade, pin_code, total_goal, goal_edit_count')
        .neq('is_active', false)
        .ilike('name', `%${name}%`);
      // pin_code 존재 여부만 반환 (실제 값은 노출 X)
      const results = (data ?? []).map(s => ({
        id: s.id, name: s.name, school: s.school, grade: s.grade,
        has_pin: !!s.pin_code,
        total_goal: s.total_goal, goal_edit_count: s.goal_edit_count,
      }));
      return Response.json(results);
    }

    // PIN 설정 (최초)
    if (action === 'set_pin') {
      if (!student_id || !pin || pin.length !== 4) {
        return Response.json({ error: 'PIN은 4자리 숫자입니다.' }, { status: 400 });
      }
      const { data: student } = await supabase
        .from('students').select('pin_code').eq('id', student_id).single();
      if (student?.pin_code) {
        return Response.json({ error: '이미 PIN이 설정되어 있습니다.' }, { status: 400 });
      }
      await supabase.from('students').update({ pin_code: pin }).eq('id', student_id);
      return Response.json({ success: true });
    }

    // PIN 로그인
    if (action === 'login') {
      if (!student_id || !pin) {
        return Response.json({ error: '이름과 PIN을 입력해주세요.' }, { status: 400 });
      }
      const { data: student } = await supabase
        .from('students')
        .select('id, name, school, grade, pin_code, total_goal, goal_edit_count')
        .eq('id', student_id)
        .single();
      if (!student) return Response.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
      if (student.pin_code !== pin) return Response.json({ error: 'PIN이 일치하지 않습니다.' }, { status: 401 });
      return Response.json({
        success: true,
        student: { id: student.id, name: student.name, school: student.school, grade: student.grade,
          total_goal: student.total_goal, goal_edit_count: student.goal_edit_count },
      });
    }

    return Response.json({ error: 'invalid action' }, { status: 400 });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
