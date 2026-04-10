'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GoalProgressBars from '@/components/GoalProgressBars';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubjectKey = 'math' | 'english' | 'korean' | 'science' | 'social' | 'etc';

interface Student {
  id: string; name: string; school: string; grade: string;
  total_goal: number; parent_phone: string; pin_code: string;
  teacher: string; class_group: string;
  is_active: boolean; season_id: string; join_date?: string; goal_edit_count?: number;
}

interface DailyRecord {
  id?: string; student_id: string; record_date: string;
  math_hours: number; english_hours: number; korean_hours: number;
  science_hours: number; social_hours: number; etc_hours: number; total_hours: number; // social_hours kept for DB compat
  input_method?: string; verified?: boolean;
}

interface SubjectHours { math: number; english: number; korean: number; science: number; social: number; etc: number; }
type StudentFormData = Omit<Student, 'season_id'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHOOLS   = ['오천고', '동성고', '영일고', '포은중', '신흥중', '동해중'];
const SUBJECTS: { key: SubjectKey; label: string }[] = [
  { key: 'math',    label: '수학' },
  { key: 'english', label: '영어' },
  { key: 'korean',  label: '국어' },
  { key: 'science', label: '과학' },
  { key: 'social',  label: '사회' },
  { key: 'etc',     label: '기타' },
];
const EMPTY_H: SubjectHours = { math: 0, english: 0, korean: 0, science: 0, social: 0, etc: 0 };
const SEASON_START      = '2026-03-16';
const TIERS = [
  { name: 'CHALLENGER',  emoji: '🔥', color: '#FF4655', min: 8.0 },
  { name: 'GRANDMASTER', emoji: '👑', color: '#FF6B00', min: 7.5 },
  { name: 'MASTER',      emoji: '💜', color: '#C084FC', min: 7.0 },
  { name: 'DIAMOND',     emoji: '💎', color: '#38BDF8', min: 6.0 },
  { name: 'PLATINUM',    emoji: '🏆', color: '#2DD4BF', min: 5.0 },
  { name: 'GOLD',        emoji: '🥇', color: '#FBBF24', min: 4.0 },
  { name: 'SILVER',      emoji: '🥈', color: '#94A3B8', min: 3.0 },
  { name: 'BRONZE',      emoji: '🍂', color: '#D97706', min: 2.0 },
  { name: 'IRON',        emoji: '⚙️',  color: '#78716C', min: 0   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTier = (avg: number) => TIERS.find(t => avg >= t.min) ?? TIERS[TIERS.length - 1];

const toKST = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const elapsedDays = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return Math.max(1, Math.floor((now.getTime() - new Date(SEASON_START).getTime()) / 86_400_000) + 1);
};

const last7Days = (): string[] => {
  const days: string[] = [];
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
};

async function fetchActiveRecords(): Promise<DailyRecord[]> {
  const res = await fetch('/api/data/records', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── Shared: HoursInput ───────────────────────────────────────────────────────

function HoursInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50">
      <span className="text-sm font-medium text-gray-700 w-24">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, Math.round((value - 0.5) * 10) / 10))}
          className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-base leading-none"
        >−</button>
        <input
          type="number"
          step="0.1"
          min="0"
          max="24"
          value={value}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(0, Math.min(24, Math.round(v * 10) / 10)));
          }}
          className="w-14 text-center text-sm font-bold tabular-nums bg-white border border-gray-200 rounded-lg py-1"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(24, Math.round((value + 0.5) * 10) / 10))}
          className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 font-bold text-base leading-none"
        >+</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Manual Entry
// ─────────────────────────────────────────────────────────────────────────────

function TabManualEntry({ students }: { students: Student[] }) {
  const [date,       setDate]       = useState(toKST());
  const [studentId,  setStudentId]  = useState('');
  const [search,     setSearch]     = useState('');
  const [hours,      setHours]      = useState<SubjectHours>(EMPTY_H);
  const [isEdit,     setIsEdit]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null);

  // 수동기록 확인
  interface ManualRecord { id: string; student_id: string; record_date: string; math_hours: number; english_hours: number; korean_hours: number; science_hours: number; etc_hours: number; total_hours: number; verified: boolean; }
  const [manualRecords, setManualRecords] = useState<ManualRecord[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);

  const fetchManualRecords = useCallback(() => {
    fetch('/api/admin/verify-record', { cache: 'no-store' }).then(r => r.json())
      .then(data => setManualRecords(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => { fetchManualRecords(); }, [fetchManualRecords]);

  const handleVerify = async (id: string) => {
    setVerifying(id);
    await fetch('/api/admin/verify-record', { cache: 'no-store', method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchManualRecords();
    setVerifying(null);
  };

  const unverifiedCount = manualRecords.filter(r => !r.verified).length;

  // Load existing record when student + date changes
  useEffect(() => {
    if (!studentId || !date) { setHours(EMPTY_H); setIsEdit(false); return; }
    setMsg(null);
    fetch(`/api/admin/records?student_id=${studentId}&record_date=${date}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setHours({ math: data.math_hours, english: data.english_hours, korean: data.korean_hours, science: data.science_hours, social: data.social_hours ?? 0, etc: data.etc_hours });
          setIsEdit(true);
        } else {
          setHours(EMPTY_H);
          setIsEdit(false);
        }
      });
  }, [studentId, date]);

  const handleSave = async () => {
    if (!studentId) { setMsg({ ok: false, text: '학생을 선택해주세요.' }); return; }
    setSaving(true); setMsg(null);
    const total_hours = Math.round(Object.values(hours).reduce((a, b) => a + b, 0) * 10) / 10;
    const res = await fetch('/api/admin/records', { cache: 'no-store', method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId, record_date: date,
        math: hours.math, english: hours.english, korean: hours.korean,
        science: hours.science, social: hours.social, etc: hours.etc,
      }),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) setMsg({ ok: false, text: result.error ?? '저장 실패' });
    else { setMsg({ ok: true, text: `저장 완료 (합계 ${total_hours}h)` }); setIsEdit(true); }
  };

  const filtered = students.filter(s => s.is_active !== false && (s.name.includes(search) || s.school.includes(search)));
  const total = Math.round(Object.values(hours).reduce((a, b) => a + b, 0) * 10) / 10;
  const sel = students.find(s => s.id === studentId);

  return (
    <>
    <div className="grid md:grid-cols-2 gap-6">
      {/* 학생 + 날짜 선택 */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">날짜</label>
          <input
            type="date" value={date}
            onChange={e => { setDate(e.target.value); setMsg(null); }}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">학생 검색</label>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 학교"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            {filtered.map(s => (
              <button
                key={s.id} type="button" onClick={() => setStudentId(s.id)}
                className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 flex justify-between items-center transition-colors ${
                  studentId === s.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span>{s.name}</span>
                <span className="text-xs text-gray-400">{s.school} {s.grade}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-6">검색 결과 없음</div>
            )}
          </div>
        </div>
      </div>

      {/* 시간 입력 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between min-h-[3rem]">
          <div>
            <p className="font-semibold text-gray-900">
              {sel ? `${sel.name} · ${sel.school} ${sel.grade}` : '학생을 선택하세요'}
            </p>
            {isEdit && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                기존 기록 불러옴
              </span>
            )}
          </div>
          <span className="text-2xl font-bold text-blue-700">{total}h</span>
        </div>

        <div className="space-y-2">
          {SUBJECTS.map(({ key, label }) => (
            <HoursInput key={key} label={label} value={hours[key]}
              onChange={v => setHours(prev => ({ ...prev, [key]: v }))} />
          ))}
        </div>

        {msg && (
          <div className={`text-sm px-4 py-2.5 rounded-xl border ${
            msg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
          }`}>{msg.text}</div>
        )}

        <button
          onClick={handleSave} disabled={saving || !studentId}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {saving ? '저장 중...' : isEdit ? '수정 저장' : '저장'}
        </button>
      </div>
    </div>

    {/* 수동기록 확인 섹션 */}
    {manualRecords.length > 0 && (
      <div className="mt-6 space-y-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          📋 학생 수동기록 확인
          {unverifiedCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unverifiedCount}</span>
          )}
        </h3>
        <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['날짜', '학생', '수학', '영어', '국어', '과학', '기타', '합계', '상태'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {manualRecords.map(r => {
                const s = students.find(x => x.id === r.student_id);
                return (
                  <tr key={r.id} className={r.verified ? 'opacity-50' : 'bg-amber-50/50'}>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.record_date}</td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{s?.name ?? '?'}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.math_hours}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.english_hours}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.korean_hours}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.science_hours}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.etc_hours}</td>
                    <td className="px-3 py-2 tabular-nums text-xs font-bold">{r.total_hours}h</td>
                    <td className="px-3 py-2">
                      {r.verified ? (
                        <span className="text-green-600 text-xs font-medium">✓ 확인완료</span>
                      ) : (
                        <button onClick={() => handleVerify(r.id)} disabled={verifying === r.id}
                          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1 rounded-lg">
                          {verifying === r.id ? '...' : '확인'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Student Management
// ─────────────────────────────────────────────────────────────────────────────

const MIDDLE_SCHOOLS = ['포은중', '신흥중', '동해중'];

function isMiddleSchool(school: string) {
  return MIDDLE_SCHOOLS.includes(school) || school.endsWith('중') || school.includes('중학');
}

function gradeOptions(school: string) {
  const middle = isMiddleSchool(school);
  return middle
    ? [{ value: '중1' }, { value: '중2' }, { value: '중3' }]
    : [{ value: '고1' }, { value: '고2' }, { value: '고3' }];
}

function StudentModal({
  mode, data, onSave, onClose, saving,
}: {
  mode: 'add' | 'edit'; data: Partial<StudentFormData>;
  onSave: (d: StudentFormData) => void; onClose: () => void; saving: boolean;
}) {
  const [form, setForm] = useState<StudentFormData>({
    id:           data.id           ?? '',
    name:         data.name         ?? '',
    school:       data.school       ?? SCHOOLS[0],
    grade:        data.grade        ?? '고1',
    total_goal:   data.total_goal   ?? 500,
    parent_phone: data.parent_phone ?? '',
    pin_code:     data.pin_code     ?? '',
    teacher:      data.teacher      ?? '',
    class_group:  data.class_group  ?? '',
    join_date:    data.join_date    ?? toKST(),
    is_active:    data.is_active    ?? true,
  });
  const [customSchool, setCustomSchool] = useState(
    data.school && !SCHOOLS.includes(data.school) ? data.school : '',
  );
  const [useCustom, setUseCustom] = useState(
    !!(data.school && !SCHOOLS.includes(data.school)),
  );

  const set = <K extends keyof StudentFormData>(k: K, v: StudentFormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSchoolChange = (val: string) => {
    if (val === '__custom__') {
      setUseCustom(true);
      setCustomSchool('');
      set('school', '');
    } else {
      setUseCustom(false);
      setCustomSchool('');
      set('school', val);
    }
  };

  const handleCustomSchool = (val: string) => {
    setCustomSchool(val);
    set('school', val);
  };

  const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const canSave = form.name.trim() !== '' && form.school.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md my-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-gray-900">
            {mode === 'add' ? '신규 학생 추가' : '학생 정보 수정'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="학생 이름"
              autoFocus={mode === 'add'}
              className={INPUT}
            />
          </div>

          {/* 학교 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              학교 <span className="text-red-400">*</span>
            </label>
            <select
              value={useCustom ? '__custom__' : form.school}
              onChange={e => handleSchoolChange(e.target.value)}
              className={INPUT}
            >
              {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__custom__">✏️ 직접입력</option>
            </select>
            {useCustom && (
              <input
                type="text"
                value={customSchool}
                onChange={e => handleCustomSchool(e.target.value)}
                placeholder="학교명 직접 입력"
                autoFocus
                className={`${INPUT} mt-2`}
              />
            )}
          </div>

          {/* 학년 + 목표시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">학년</label>
              <select
                value={form.grade}
                onChange={e => set('grade', e.target.value)}
                className={INPUT}
              >
                {gradeOptions(form.school).map(({ value }) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">시즌 총 목표(h)</label>
              <input
                type="number" step="10" min="0" max="3000"
                value={form.total_goal}
                onChange={e => set('total_goal', parseFloat(e.target.value) || 0)}
                className={INPUT}
              />
            </div>
          </div>

          {/* 담당선생님 + 분반 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">담당선생님</label>
              <input value={form.teacher} onChange={e => set('teacher', e.target.value)} placeholder="예: 김재현" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">분반</label>
              <input value={form.class_group} onChange={e => set('class_group', e.target.value)} placeholder="예: A반" className={INPUT} />
            </div>
          </div>

          {/* 참가일 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">참가일</label>
            <input type="date" value={form.join_date} onChange={e => set('join_date', e.target.value)} className={INPUT} />
          </div>

          {/* 학부모 연락처 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">학부모 전화번호</label>
            <input value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} placeholder="010-0000-0000" className={INPUT} />
          </div>

          {/* PIN 코드 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">PIN 코드 (선택)</label>
            <input value={form.pin_code} onChange={e => set('pin_code', e.target.value)} placeholder="4자리 숫자" maxLength={4} className={INPUT} />
          </div>
        </div>

        {/* 미입력 경고 */}
        {!canSave && (form.name || form.school) && (
          <p className="text-xs text-red-500 mt-3">
            {!form.name.trim() ? '이름을 입력해주세요.' : '학교명을 입력해주세요.'}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !canSave}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? '저장 중...' : mode === 'add' ? '추가하기' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabStudents({ students, onRefresh }: { students: Student[]; onRefresh: () => Promise<void> }) {
  const [search,       setSearch]       = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [modal,        setModal]        = useState<{ mode: 'add' | 'edit'; data: Partial<StudentFormData> } | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [showBulk,     setShowBulk]     = useState(false);
  const [bulkText,     setBulkText]     = useState('');
  const [bulkResult,   setBulkResult]   = useState('');
  const [sortKey,      setSortKey]      = useState<string>('name');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc');

  const toggleActive = async (id: string, cur: boolean) => {
    await fetch('/api/admin/students', { cache: 'no-store', method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !cur }),
    });
    await onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await fetch('/api/admin/students', { cache: 'no-store', method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteId }),
    });
    setDeleteId(null);
    await onRefresh();
  };

  const handleSave = async (form: StudentFormData) => {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...insertData } = form;
      const res = await fetch('/api/admin/students', { cache: 'no-store', method: modal?.mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modal?.mode === 'add' ? insertData : form),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`오류: ${data.error ?? '저장 실패'}`);
        setSaving(false);
        return;
      }
      await onRefresh();
      setModal(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkPhone = async () => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    let updated = 0;
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(s => s.trim());
      if (parts.length < 2) continue;
      const [name, phone] = parts;
      const student = students.find(s => s.name === name);
      if (!student) continue;
      const normalized = phone.replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
      await fetch('/api/admin/students', { cache: 'no-store', method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: student.id, parent_phone: normalized }),
      });
      updated++;
    }
    await onRefresh();
    setBulkResult(`${updated}명 업데이트 완료 (${lines.length}건 중)`);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = students
    .filter(s =>
      (!search || s.name.includes(search) || s.school.includes(search)) &&
      (!schoolFilter || s.school === schoolFilter),
    )
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortKey as keyof Student] ?? '';
      const bv = b[sortKey as keyof Student] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'ko') * dir;
    });

  return (
    <div className="space-y-4">
      {/* 필터 + 추가 버튼 */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름/학교 검색"
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
          <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">전체 학교</option>
            {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length}명</span>
          <button onClick={() => setShowBulk(!showBulk)}
            className="border border-gray-300 text-gray-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            📋 전화번호 일괄입력
          </button>
          <button onClick={() => setModal({ mode: 'add', data: {} })}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            + 학생 추가
          </button>
        </div>
      </div>

      {/* CSV 일괄 입력 패널 */}
      {showBulk && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">📋 전화번호 일괄 입력</p>
            <button onClick={() => { setShowBulk(false); setBulkResult(''); }} className="text-gray-400 hover:text-gray-600 text-sm">닫기</button>
          </div>
          <p className="text-xs text-gray-500">한 줄에 &quot;이름,전화번호&quot; 형식으로 입력하세요. 탭 구분도 가능합니다.</p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder={"홍길동,010-1234-5678\n김철수,01087654321\n이영희,010-1111-2222"}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-3">
            <button onClick={handleBulkPhone}
              disabled={!bulkText.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl">
              일괄 적용
            </button>
            {bulkResult && <span className="text-sm text-green-600 font-medium">{bulkResult}</span>}
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {([
                { label: '이름', key: 'name' },
                { label: '학교', key: 'school' },
                { label: '학년', key: 'grade' },
                { label: '담당', key: 'teacher' },
                { label: '분반', key: 'class_group' },
                { label: '목표(h)', key: 'total_goal' },
                { label: '연락처', key: 'parent_phone' },
                { label: 'PIN', key: null },
                { label: '상태', key: 'is_active' },
                { label: '관리', key: null },
              ] as const).map(({ label, key }) => (
                <th key={label}
                  onClick={key ? () => toggleSort(key) : undefined}
                  className={`text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${key ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}>
                  {label}
                  {key && sortKey === key && (
                    <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                  {key && sortKey !== key && (
                    <span className="ml-1 text-gray-300">▲▼</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">검색 결과 없음</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-blue-600 cursor-pointer hover:underline"
                  onClick={() => setModal({ mode: 'edit', data: s })}>{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.school}</td>
                <td className="px-4 py-3 text-gray-600">{s.grade}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.teacher || '-'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.class_group || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{s.total_goal}h</td>
                <td className="px-4 py-3">
                  {s.parent_phone ? <span className="text-gray-600">{s.parent_phone}</span> : <span className="text-red-400 text-xs">미등록</span>}
                </td>
                <td className="px-4 py-3">
                  {s.pin_code ? (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-gray-500">{s.pin_code}</span>
                      <button onClick={async (e) => { e.stopPropagation(); await fetch('/api/admin/students', { cache: 'no-store', method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, pin_code: '' }) }); onRefresh(); }}
                        className="text-red-400 hover:text-red-600 text-[10px]" title="PIN 초기화">↺</button>
                    </div>
                  ) : <span className="text-gray-300 text-xs">미설정</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(s.id, s.is_active)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      s.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {s.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setModal({ mode: 'edit', data: s })}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium">수정</button>
                    <button onClick={() => setDeleteId(s.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <StudentModal mode={modal.mode} data={modal.data} onSave={handleSave} onClose={() => setModal(null)} saving={saving} />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg text-gray-900 mb-2">학생 삭제</h3>
            <p className="text-gray-600 text-sm mb-5">
              정말 삭제하시겠습니까? 해당 학생의 모든 기록도 함께 삭제될 수 있습니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Parent Notifications
// ─────────────────────────────────────────────────────────────────────────────

function TabNotifications({ students }: { students: Student[] }) {
  const [records,     setRecords]     = useState<DailyRecord[]>([]);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [previewId,   setPreviewId]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [sendResults, setSendResults] = useState<Map<string, boolean>>(new Map());
  const [ntSearch,    setNtSearch]    = useState('');
  const [ntSchool,    setNtSchool]    = useState('');

  useEffect(() => {
    fetchActiveRecords().then(data => { setRecords(data); setLoading(false); });
  }, []);

  const elapsed = elapsedDays();
  const days7   = last7Days();

  const filteredStudents = useMemo(() =>
    students.filter(s =>
      (!ntSearch || s.name.includes(ntSearch)) &&
      (!ntSchool || s.school === ntSchool)
    ), [students, ntSearch, ntSchool]);

  // Pre-compute all rankings once
  const rankings = useMemo(() => {
    return students
      .map(s => {
        const recs  = records.filter(r => r.student_id === s.id);
        const total = Math.round(recs.reduce((a, r) => a + r.total_hours, 0) * 10) / 10;
        return { id: s.id, total, avg: Math.round((total / elapsed) * 10) / 10 };
      })
      .sort((a, b) => b.total - a.total);
  }, [records, students, elapsed]);

  const getStats = useCallback((sid: string) => {
    const s    = students.find(x => x.id === sid)!;
    const recs = records.filter(r => r.student_id === sid);
    const total     = Math.round(recs.reduce((a, r) => a + r.total_hours, 0) * 10) / 10;
    const daily_avg = Math.round((total / elapsed) * 10) / 10;
    const achievement = s.total_goal > 0 ? Math.round((total / s.total_goal) * 1000) / 10 : 0;
    const tier = getTier(daily_avg);
    const rank = rankings.findIndex(r => r.id === sid) + 1;
    const subjectTotals = {
      math:    Math.round(recs.reduce((a, r) => a + r.math_hours,    0) * 10) / 10,
      english: Math.round(recs.reduce((a, r) => a + r.english_hours, 0) * 10) / 10,
      korean:  Math.round(recs.reduce((a, r) => a + r.korean_hours,  0) * 10) / 10,
      science: Math.round(recs.reduce((a, r) => a + r.science_hours, 0) * 10) / 10,
      social:  Math.round(recs.reduce((a, r) => a + (r.social_hours ?? 0), 0) * 10) / 10,
      etc:     Math.round(recs.reduce((a, r) => a + r.etc_hours,     0) * 10) / 10,
    };
    const recentDays = days7.map(date => ({
      date,
      total: recs.find(r => r.record_date === date)?.total_hours ?? 0,
      hasRecord: recs.some(r => r.record_date === date),
    }));

    // 학생별 시즌진행률 + 일일 필요시간
    const SEASON_END = '2026-06-30';
    const today = toKST();
    const firstDate = recs.length > 0 ? recs.map(r => r.record_date).sort()[0] : today;
    const totalDays = Math.max(1, Math.floor((new Date(SEASON_END).getTime() - new Date(firstDate).getTime()) / 86_400_000) + 1);
    const elapsedDaysStudent = Math.max(1, Math.floor((new Date(today).getTime() - new Date(firstDate).getTime()) / 86_400_000) + 1);
    const remaining = Math.max(1, Math.floor((new Date(SEASON_END).getTime() - new Date(today).getTime()) / 86_400_000) + 1);
    const seasonProgress = Math.round((elapsedDaysStudent / totalDays) * 1000) / 10;
    const dailyRequired = s.total_goal > 0
      ? Math.round(Math.max(0, (s.total_goal - total) / remaining) * 10) / 10 : 0;

    // AI 피드백
    const feedbacks: string[] = [];
    // 과목별 밸런스
    if (total > 0) {
      const mathRatio = Math.round((subjectTotals.math / total) * 100);
      const nonZeroSubjects = Object.values(subjectTotals).filter(v => v > 0).length;
      if (nonZeroSubjects <= 2 && total > 10) {
        feedbacks.push(`⚠️ 특정 과목에 편중되어 있습니다. 균형 잡힌 학습이 필요합니다.`);
      } else if (mathRatio >= 60) {
        feedbacks.push(`수학 학습량이 충분합니다 ✅ 다만 다른 과목도 균형있게 배분하면 더 좋겠습니다.`);
      } else if (mathRatio >= 40) {
        feedbacks.push(`과목별 학습 밸런스가 잘 잡혀있습니다 ✅`);
      } else {
        feedbacks.push(`⚠️ 수학 학습량이 전체의 ${mathRatio}%로 부족합니다. 수학 공부 시간을 늘려주세요.`);
      }
    }
    // 목표 달성 진도
    if (s.total_goal > 0 && total > 0) {
      if (achievement > seasonProgress) {
        feedbacks.push(`🎉 시즌 진행 대비 목표 달성이 앞서고 있습니다! 이 페이스 유지하면 목표 달성 가능합니다.`);
      } else if (achievement >= seasonProgress * 0.9) {
        feedbacks.push(`📊 시즌 진행과 비슷한 페이스입니다. 조금만 더 힘내면 목표 달성할 수 있습니다.`);
      } else {
        feedbacks.push(`⚠️ 시즌 진행 대비 목표 달성이 뒤처지고 있습니다. 하루 ${dailyRequired}시간 이상 공부해야 목표를 달성할 수 있습니다.`);
      }
    }

    return { total, daily_avg, achievement, seasonProgress, dailyRequired, tier, rank, subjectTotals, recentDays, feedbacks };
  }, [records, students, elapsed, rankings, days7]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPreviewId(id);
  };

  const toggleAll = () => {
    if (selected.size === filteredStudents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredStudents.map(s => s.id)));
      setPreviewId(filteredStudents[0]?.id ?? null);
    }
  };

  const handleSend = async () => {
    setSending(true);
    const results = new Map<string, boolean>();
    for (const id of Array.from(selected)) {
      await new Promise(r => setTimeout(r, 80)); // simulate API call
      results.set(id, true);
      setSendResults(new Map(results)); // live update
    }
    setSending(false);
  };

  const preview = previewId ? { student: students.find(s => s.id === previewId)!, stats: getStats(previewId) } : null;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* 학생 선택 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">학생 선택</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{selected.size}명 선택 / {filteredStudents.length}명</span>
            <button onClick={toggleAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              {selected.size === filteredStudents.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
        </div>

        {/* 검색 + 학교 필터 */}
        <div className="flex gap-2">
          <input type="text" value={ntSearch} onChange={e => setNtSearch(e.target.value)} placeholder="이름 검색"
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={ntSchool} onChange={e => setNtSchool(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">전체</option>
            {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
          ) : filteredStudents.map(s => {
            const tier = loading ? null : getTier(Math.round(records.filter(r => r.student_id === s.id).reduce((a, r) => a + r.total_hours, 0) / elapsed * 10) / 10);
            const sent = sendResults.get(s.id);
            return (
              <div
                key={s.id}
                onClick={() => toggleSelect(s.id)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                  selected.has(s.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                } ${previewId === s.id ? 'ring-1 ring-inset ring-blue-200' : ''}`}
              >
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => {}}
                  className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.school}</span>
                  </div>
                  {tier && <span className="text-xs" style={{ color: tier.color }}>{tier.emoji} {tier.name}</span>}
                </div>
                {sent !== undefined && (
                  <span className={`text-xs font-medium ${sent ? 'text-green-600' : 'text-red-500'}`}>
                    {sent ? '✓ 발송' : '✗ 실패'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSend}
          disabled={selected.size === 0 || sending}
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {sending
            ? `발송 중... (${sendResults.size}/${selected.size}명)`
            : `📱 알림톡 발송 (${selected.size}명)`}
        </button>

        {sendResults.size > 0 && sendResults.size === selected.size && !sending && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            ✓ {sendResults.size}명에게 알림톡 발송 완료 <span className="text-green-500 text-xs">(mock)</span>
          </div>
        )}
      </div>

      {/* 리포트 미리보기 */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">리포트 미리보기</h3>
        {preview ? (
          <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50 text-sm overflow-y-auto max-h-[500px]">
            <div className="text-center space-y-1">
              <p className="font-bold text-base">📊 매플 순공리그 SEASON 2 학습 현황</p>
              <p className="text-gray-600">안녕하세요, <strong>{preview.student.name}</strong> 학부모님</p>
            </div>

            <div className="grid grid-cols-4 gap-2 bg-white rounded-xl py-3 border border-gray-100">
              {[
                { label: '티어', value: preview.stats.tier.emoji, sub: preview.stats.tier.name, color: preview.stats.tier.color },
                { label: '순위',  value: `${preview.stats.rank}위`, sub: `${students.length}명 중` },
                { label: '일평균', value: `${preview.stats.daily_avg}h`, sub: '' },
                { label: '개별목표달성률', value: `${preview.stats.achievement}%`, sub: '' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="text-center">
                  <p className="text-xl font-black" style={color ? { color } : {}}>{value}</p>
                  {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {/* 프로그레스 바 */}
            {preview.student.total_goal > 0 && (
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <GoalProgressBars
                  seasonProgress={preview.stats.seasonProgress}
                  achievement={preview.stats.achievement}
                  totalGoal={preview.student.total_goal}
                  accumulated={preview.stats.total}
                />
              </div>
            )}

            {/* AI 피드백 */}
            {preview.stats.feedbacks.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-gray-700">🤖 AI 분석</p>
                {preview.stats.feedbacks.map((fb, i) => (
                  <div key={i} className="bg-white rounded-xl px-3 py-2 border border-gray-100 text-xs text-gray-700">
                    {fb}
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="font-semibold text-gray-700 mb-2">📚 과목별 누적 현황 (총 {preview.stats.total}h)</p>
              {(() => {
                const st = preview.stats.subjectTotals;
                const t = preview.stats.total || 1;
                const maxKey = (Object.keys(st) as SubjectKey[]).reduce((a, b) => st[a] > st[b] ? a : b);
                return (
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {SUBJECTS.map(({ key, label }) => {
                      const pct = Math.round((st[key] / t) * 100);
                      const isMax = key === maxKey && st[key] > 0;
                      return (
                        <div key={key} className={`rounded-lg py-2 border ${isMax ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                          <p className={`text-sm tabular-nums ${isMax ? 'font-black text-blue-700' : 'font-bold text-gray-900'}`}>{st[key]}h</p>
                          <p className="text-[10px] text-gray-400 tabular-nums">({pct}%)</p>
                          <p className="text-xs text-gray-500">{label}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div>
              <p className="font-semibold text-gray-700 mb-2">📅 최근 7일</p>
              <div className="space-y-1">
                {preview.stats.recentDays.map(({ date, total, hasRecord }) => (
                  <div key={date} className={`flex justify-between px-3 py-1.5 rounded-lg border ${
                    hasRecord ? 'bg-white border-gray-100' : 'bg-red-50 border-red-100'
                  }`}>
                    <span className={`text-xs ${hasRecord ? 'text-gray-600' : 'text-red-500'}`}>{date}</span>
                    <span className={`text-xs font-bold ${hasRecord ? 'text-blue-700' : 'text-red-500'}`}>
                      {hasRecord ? `${total}h` : '미제출'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl p-10 text-center text-gray-400 text-sm bg-gray-50">
            왼쪽에서 학생을 선택하면<br />리포트를 미리볼 수 있어요
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Records Management
// ─────────────────────────────────────────────────────────────────────────────

function TabRecords({ students }: { students: Student[] }) {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(toKST());
  const [editRecord, setEditRecord] = useState<DailyRecord | null>(null);
  const [editHours, setEditHours] = useState<SubjectHours>(EMPTY_H);
  const [saving, setSaving] = useState(false);
  const [detailStudent, setDetailStudent] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    const data = await fetchActiveRecords();
    setRecords(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const studentMap = useMemo(() => {
    const m = new Map<string, Student>();
    students.forEach(s => m.set(s.id, s));
    return m;
  }, [students]);

  const filtered = useMemo(() => {
    return records
      .filter(r => {
        const s = studentMap.get(r.student_id);
        if (!s) return false;
        if (search && !s.name.includes(search)) return false;
        if (schoolFilter && s.school !== schoolFilter) return false;
        if (methodFilter && r.input_method !== methodFilter) return false;
        if (dateFrom && r.record_date < dateFrom) return false;
        if (dateTo && r.record_date > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.record_date.localeCompare(a.record_date));
  }, [records, studentMap, search, schoolFilter, methodFilter, dateFrom, dateTo]);

  const detailRecords = useMemo(() => {
    if (!detailStudent) return [];
    return records.filter(r => r.student_id === detailStudent).sort((a, b) => a.record_date.localeCompare(b.record_date));
  }, [records, detailStudent]);

  const openEdit = (r: DailyRecord) => {
    setEditRecord(r);
    setEditHours({
      math: r.math_hours, english: r.english_hours, korean: r.korean_hours,
      science: r.science_hours, social: r.social_hours ?? 0, etc: r.etc_hours,
    });
  };

  const handleSaveEdit = async () => {
    if (!editRecord?.id) { alert('기록 ID가 없습니다'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/records-manage', { cache: 'no-store', method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editRecord.id,
          math_hours: editHours.math, english_hours: editHours.english, korean_hours: editHours.korean,
          science_hours: editHours.science, social_hours: editHours.social, etc_hours: editHours.etc,
          verified: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`수정 실패: ${data.error ?? '알 수 없는 오류'}`); return; }
      await fetchRecords();
      setEditRecord(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!editRecord?.id) return;
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    const res = await fetch('/api/admin/records-manage', { cache: 'no-store', method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editRecord.id }),
    });
    const data = await res.json();
    if (!res.ok) { alert(`삭제 실패: ${data.error ?? '알 수 없는 오류'}`); return; }
    await fetchRecords();
    setEditRecord(null);
  };

  const handleVerify = async (id: string) => {
    await fetch('/api/admin/verify-record', { cache: 'no-store', method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchRecords();
  };

  const methodIcon = (m?: string) => {
    if (m === 'screenshot') return '📷';
    if (m === 'manual_student') return '⚠️';
    return '✏️';
  };

  const detailStudentObj = detailStudent ? studentMap.get(detailStudent) : null;

  if (loading) return <div className="text-center py-10 text-gray-400">로딩 중...</div>;

  // 상세 뷰
  if (detailStudent && detailStudentObj) {
    const maxH = Math.max(...detailRecords.map(r => r.total_hours), 1);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setDetailStudent(null)} className="text-blue-600 text-sm hover:underline">&larr; 목록으로</button>
          <h3 className="font-bold text-gray-900 text-lg">{detailStudentObj.name} ({detailStudentObj.school} {detailStudentObj.grade})</h3>
          <span className="text-sm text-gray-500">{detailRecords.length}일 기록</span>
        </div>

        {/* 막대 차트 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">일별 공부 시간</p>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {detailRecords.map(r => (
              <div key={r.record_date} className="flex flex-col items-center flex-shrink-0" style={{ width: '28px' }}>
                <span className="text-[8px] text-gray-500 mb-0.5">{r.total_hours}</span>
                <div className="w-5 rounded-t" style={{
                  height: `${(r.total_hours / maxH) * 100}%`,
                  minHeight: '2px',
                  background: 'linear-gradient(180deg, #3B82F6, #60A5FA)',
                }} />
                <span className="text-[7px] text-gray-400 mt-0.5 -rotate-45 origin-top-left whitespace-nowrap">
                  {r.record_date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 상세 기록 테이블 */}
        <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['날짜', '수학', '영어', '국어', '과학', '사회', '기타', '합계', '방식'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detailRecords.map(r => (
                <tr key={r.record_date} className={`hover:bg-gray-50 cursor-pointer ${r.verified === false ? 'bg-red-50' : ''}`}
                  onClick={() => openEdit(r)}>
                  <td className="px-3 py-2 text-xs">{r.record_date}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.math_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.english_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.korean_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.science_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.social_hours ?? 0}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.etc_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs font-bold">{r.total_hours}h</td>
                  <td className="px-3 py-2 text-xs">{methodIcon(r.input_method)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="학생 이름 검색"
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">전체 학교</option>
          {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">전체 방식</option>
          <option value="screenshot">📷 스크린샷</option>
          <option value="manual">✏️ 관리자</option>
          <option value="manual_student">⚠️ 학생수동</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 text-sm">~</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-sm text-gray-500 ml-auto">{filtered.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['날짜', '이름', '학교', '수학', '영어', '국어', '과학', '사회', '기타', '합계', '방식', '확인'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.slice(0, 200).map((r, i) => {
              const s = studentMap.get(r.student_id);
              return (
                <tr key={r.id ?? i}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${r.verified === false ? 'bg-red-50' : ''}`}
                  onClick={() => openEdit(r)}>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.record_date}</td>
                  <td className="px-3 py-2 text-sm font-medium">
                    <button onClick={e => { e.stopPropagation(); if (s) setDetailStudent(s.id); }}
                      className="text-blue-600 hover:underline">{s?.name ?? '?'}</button>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{s?.school}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.math_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.english_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.korean_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.science_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.social_hours ?? 0}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{r.etc_hours}</td>
                  <td className="px-3 py-2 tabular-nums text-xs font-bold">{r.total_hours}h</td>
                  <td className="px-3 py-2 text-center">{methodIcon(r.input_method)}</td>
                  <td className="px-3 py-2 text-center">
                    {r.verified === false ? (
                      <button onClick={e => { e.stopPropagation(); if (r.id) handleVerify(r.id); }}
                        className="text-red-500 hover:text-green-600 font-bold text-xs">❌</button>
                    ) : <span className="text-green-600 text-xs">✅</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">조건에 맞는 기록이 없습니다</div>
        )}
      </div>

      {/* 수정 모달 */}
      {editRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">
                기록 수정 — {studentMap.get(editRecord.student_id)?.name} ({editRecord.record_date})
              </h3>
              <button onClick={() => setEditRecord(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              {SUBJECTS.map(({ key, label }) => (
                <HoursInput key={key} label={label} value={editHours[key]}
                  onChange={v => setEditHours(prev => ({ ...prev, [key]: v }))} />
              ))}
              <div className="flex justify-between text-sm text-gray-600 px-1 pt-2 border-t">
                <span>합계</span>
                <span className="font-bold">{Math.round(Object.values(editHours).reduce((a, b) => a + b, 0) * 10) / 10}h</span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleDeleteRecord}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50">삭제</button>
              <div className="flex-1" />
              <button onClick={() => setEditRecord(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">취소</button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4: Statistics
// ─────────────────────────────────────────────────────────────────────────────

function TabStats({ students }: { students: Student[] }) {
  const [records,     setRecords]     = useState<DailyRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [subjectView, setSubjectView] = useState<SubjectKey>('math');

  useEffect(() => {
    fetchActiveRecords().then(data => { setRecords(data); setLoading(false); });
  }, []);

  const elapsed = elapsedDays();
  const days7   = useMemo(() => last7Days(), []);
  const today   = toKST();

  const studentStats = useMemo(() => students.map(s => {
    const recs = records.filter(r => r.student_id === s.id);
    const total = Math.round(recs.reduce((a, r) => a + r.total_hours, 0) * 10) / 10;
    return {
      ...s,
      total,
      daily_avg: Math.round((total / elapsed) * 10) / 10,
      subjectSums: {
        math:    recs.reduce((a, r) => a + r.math_hours,    0),
        english: recs.reduce((a, r) => a + r.english_hours, 0),
        korean:  recs.reduce((a, r) => a + r.korean_hours,  0),
        science: recs.reduce((a, r) => a + r.science_hours, 0),
        social:  recs.reduce((a, r) => a + (r.social_hours ?? 0), 0),
        etc:     recs.reduce((a, r) => a + r.etc_hours,     0),
      },
    };
  }), [records, students, elapsed]);

  // ── 학교별 베이지안 대항전 (k = 5) ──
  const bayesianSchools = useMemo(() => {
    const k = 5;
    const globalAvg = studentStats.length
      ? studentStats.reduce((a, s) => a + s.daily_avg, 0) / studentStats.length
      : 0;

    return SCHOOLS
      .map(school => {
        const group = studentStats.filter(s => s.school === school);
        const n = group.length;
        if (n === 0) return null;
        const groupAvg = group.reduce((a, s) => a + s.daily_avg, 0) / n;
        const score    = (n / (n + k)) * groupAvg + (k / (n + k)) * globalAvg;
        return { school, n, groupAvg: Math.round(groupAvg * 100) / 100, score: Math.round(score * 100) / 100 };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.score - a.score);
  }, [studentStats]);

  // ── 과목별 TOP 10 ──
  const subjectTop10 = useMemo(() =>
    [...studentStats]
      .sort((a, b) => b.subjectSums[subjectView] - a.subjectSums[subjectView])
      .slice(0, 10)
      .map(s => ({ ...s, val: Math.round(s.subjectSums[subjectView] * 10) / 10 })),
    [studentStats, subjectView]);

  // ── 출석 현황 (최근 7일) ──
  const attendance = useMemo(() =>
    students
      .filter(s => s.is_active !== false)
      .map(s => {
        const days = days7.map(date => ({
          date,
          submitted: records.some(r => r.student_id === s.id && r.record_date === date),
        }));
        return { ...s, days, missCount: days.filter(d => !d.submitted).length };
      })
      .sort((a, b) => a.missCount - b.missCount),
    [students, records, days7]);

  if (loading) {
    return <div className="text-center py-16 text-gray-400">통계 계산 중...</div>;
  }

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-10">

      {/* ── 학교별 대항전 ── */}
      <section>
        <h3 className="font-bold text-gray-900 text-base mb-1">🏫 학교별 대항전</h3>
        <p className="text-xs text-gray-500 mb-4">
          베이지안 수축 보정 (k=5) — 표본이 적은 학교의 점수를 전체 평균 방향으로 보정
        </p>
        <div className="space-y-2">
          {bayesianSchools.map((s, i) => {
            const max = bayesianSchools[0]?.score ?? 1;
            return (
              <div key={s.school} className="flex items-center gap-4 bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xl w-8 text-center">{MEDAL[i] ?? `${i + 1}`}</span>
                <span className="w-16 font-semibold text-gray-900 text-sm">{s.school}</span>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(s.score / max) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs w-40">
                  <span className="font-bold text-blue-700 text-sm">{s.score}h</span>
                  <span className="text-gray-400 ml-2">실평균 {s.groupAvg}h · {s.n}명</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 과목별 TOP 10 ── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h3 className="font-bold text-gray-900 text-base">📚 과목별 TOP 10</h3>
          <div className="flex gap-1 flex-wrap">
            {SUBJECTS.map(({ key, label }) => (
              <button key={key} onClick={() => setSubjectView(key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  subjectView === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {subjectTop10.map((s, i) => {
            const max = subjectTop10[0]?.val ?? 1;
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-xl">
                <span className="text-sm w-6 text-center">{MEDAL[i] ?? `${i + 1}`}</span>
                <span className="w-16 font-semibold text-sm text-gray-900">{s.name}</span>
                <span className="w-14 text-xs text-gray-400">{s.school}</span>
                <div className="flex-1">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${max > 0 ? (s.val / max) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="font-bold text-blue-700 text-sm tabular-nums w-14 text-right">{s.val}h</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 출석 현황 ── */}
      <section>
        <h3 className="font-bold text-gray-900 text-base mb-4">📅 출석 현황 (최근 7일)</h3>
        <div className="rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">이름</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">학교</th>
                {days7.map(d => (
                  <th key={d} className="text-center px-2 py-3 font-semibold text-gray-500">
                    {d.slice(5)}{d === today ? ' ★' : ''}
                  </th>
                ))}
                <th className="text-center px-3 py-3 font-semibold text-gray-500 uppercase">미제출</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendance.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.missCount >= 5 ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{s.school}</td>
                  {s.days.map(({ date, submitted }) => (
                    <td key={date} className="px-2 py-2.5 text-center">
                      {submitted
                        ? <span className="text-green-600 font-bold">✓</span>
                        : <span className="text-red-400 font-bold">✗</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-bold ${
                      s.missCount >= 4 ? 'text-red-600' : s.missCount >= 2 ? 'text-yellow-600' : 'text-green-600'
                    }`}>{s.missCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminPage
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'entry' | 'students' | 'records' | 'notifications' | 'stats';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'entry',         label: '수동 입력',     icon: '✏️'  },
  { id: 'students',      label: '학생 관리',     icon: '👥'  },
  { id: 'records',       label: '기록 관리',     icon: '📋'  },
  { id: 'notifications', label: '학부모 알림',   icon: '📱'  },
  { id: 'stats',         label: '통계',          icon: '📊'  },
];

export default function AdminPage() {
  const supabase  = createClient();
  const router    = useRouter();
  const [tab,      setTab]      = useState<TabId>('entry');
  const [students, setStudents] = useState<Student[]>([]);
  const [email,    setEmail]    = useState('');
  const [unverifiedCount, setUnverifiedCount] = useState(0);

  const refreshStudents = useCallback(async () => {
    const res = await fetch('/api/data/students-all', { cache: 'no-store' });
    const data = await res.json();
    setStudents(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    refreshStudents();
    fetch('/api/admin/verify-record', { cache: 'no-store' }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUnverifiedCount(data.filter((r: { verified: boolean }) => !r.verified).length);
    });
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  const activeStudents = students.filter(s => s.is_active !== false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-black">M</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-sm">매플 순공리그</h1>
              <p className="text-xs text-gray-400">관리자 페이지</p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">{email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 overflow-x-auto scrollbar-none">
          <nav className="flex">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.id === 'entry' && unverifiedCount > 0 && (
                  <span className="ml-0.5 text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">{unverifiedCount}</span>
                )}
                {(t.id === 'students' || t.id === 'notifications') && (
                  <span className="ml-0.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {t.id === 'students' ? students.length : activeStudents.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {tab === 'entry'         && <TabManualEntry   students={students} />}
        {tab === 'students'      && <TabStudents students={students} onRefresh={refreshStudents} />}
        {tab === 'records'       && <TabRecords       students={students} />}
        {tab === 'notifications' && <TabNotifications students={activeStudents} />}
        {tab === 'stats'         && <TabStats         students={activeStudents} />}
      </main>
    </div>
  );
}
