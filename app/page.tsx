'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import GoalProgressBars from '@/components/GoalProgressBars';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentSession {
  id: string; name: string; school: string; grade: string;
  total_goal: number; goal_edit_count: number;
}

interface SubjectHours {
  math: number; english: number; korean: number; science: number; etc: number;
}

interface SubmitResult {
  total: number; accumulated: number; rank: number; total_students: number;
  daily_avg: number; achievement: number; total_goal: number;
  daily_required: number; season_progress: number;
  tier: { name: string; color: string; emoji?: string } | null;
}

const SUBJECTS: { key: keyof SubjectHours; label: string; bar: string; badge: string }[] = [
  { key: 'math',    label: '수학',      bar: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  { key: 'english', label: '영어',      bar: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-100' },
  { key: 'korean',  label: '국어',      bar: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-100' },
  { key: 'science', label: '과학·사탐', bar: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-100' },
  { key: 'etc',     label: '기타',      bar: 'bg-gray-400',   badge: 'bg-gray-50 text-gray-600 border-gray-100' },
];

// ─── 날짜/시간 헬퍼 ──────────────────────────────────────────────────────────

function kstNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 오후5시~다음날5시 → 해당 날짜 기록. 5시~17시 → 입력불가. */
function getRecordInfo(): { canSubmit: boolean; recordDate: string; message: string } {
  const now = kstNow();
  const hour = now.getHours();

  if (hour >= 17) {
    // 오후 5시 이후 → 오늘 날짜
    return { canSubmit: true, recordDate: formatDate(now), message: '' };
  } else if (hour < 5) {
    // 오전 5시 이전 → 어제 날짜
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { canSubmit: true, recordDate: formatDate(yesterday), message: '' };
  } else {
    // 9시~17시 → 입력 불가
    return { canSubmit: false, recordDate: '', message: '⏰ 오늘의 기록은 오후 5시부터 입력할 수 있습니다' };
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  // localStorage에서 세션 복원
  useEffect(() => {
    const saved = localStorage.getItem('maple_student');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    setLoaded(true);
  }, []);

  const handleLogin = (s: StudentSession) => {
    setSession(s);
    localStorage.setItem('maple_student', JSON.stringify(s));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('maple_student');
  };

  if (!loaded) return null;

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <RecordScreen session={session} onLogout={handleLogout} onUpdateSession={handleLogin} />;
}

// ─── 로그인 화면 ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (s: StudentSession) => void }) {
  const [name, setName] = useState('');
  const [results, setResults] = useState<(StudentSession & { has_pin: boolean })[]>([]);
  const [selected, setSelected] = useState<(StudentSession & { has_pin: boolean }) | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingPin, setSettingPin] = useState(false);

  const handleSearch = async () => {
    if (!name.trim()) return;
    setLoading(true); setError(''); setResults([]); setSelected(null);
    const res = await fetch('/api/students/auth', { cache: 'no-store', method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', name: name.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (Array.isArray(data) && data.length > 0) setResults(data);
    else setError('학생을 찾을 수 없습니다. 이름을 정확히 입력해주세요.');
  };

  const handleSelect = (s: typeof results[0]) => {
    setSelected(s);
    setPin('');
    setError('');
    setSettingPin(!s.has_pin);
  };

  const handleSubmit = async () => {
    if (!selected || pin.length !== 4) return;
    setLoading(true); setError('');

    if (settingPin) {
      // PIN 설정
      const res = await fetch('/api/students/auth', { cache: 'no-store', method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pin', student_id: selected.id, pin }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setError(data.error); return; }
      onLogin({ id: selected.id, name: selected.name, school: selected.school, grade: selected.grade,
        total_goal: selected.total_goal, goal_edit_count: selected.goal_edit_count });
    } else {
      // PIN 로그인
      const res = await fetch('/api/students/auth', { cache: 'no-store', method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', student_id: selected.id, pin }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) { setError(data.error); return; }
      onLogin(data.student);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">매플 순공리그</h1>
          <p className="text-blue-300 text-sm mt-2">로그인하고 오늘의 순공을 기록하세요</p>
        </div>

        {!selected ? (
          <div className="bg-white rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-gray-800 font-bold text-base">학생 찾기</h2>
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="이름 입력" autoFocus
                className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              <button onClick={handleSearch} disabled={loading || !name.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl text-sm">
                {loading ? '...' : '검색'}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            {results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{results.length}명 검색됨 — 본인을 선택하세요</p>
                {results.map(s => (
                  <button key={s.id} onClick={() => handleSelect(s)}
                    className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:bg-blue-50 transition-colors">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className="text-gray-500 text-sm ml-2">{s.school} {s.grade}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-gray-800 font-bold text-base">
                {settingPin ? 'PIN 설정' : 'PIN 입력'}
              </h2>
              <button onClick={() => { setSelected(null); setPin(''); }}
                className="text-blue-600 text-xs hover:underline">뒤로</button>
            </div>
            <div className="text-center py-2">
              <p className="text-gray-900 font-bold text-lg">{selected.name}</p>
              <p className="text-gray-500 text-sm">{selected.school} {selected.grade}</p>
            </div>
            {settingPin && (
              <p className="text-amber-600 text-xs text-center bg-amber-50 rounded-xl px-3 py-2">
                처음 접속입니다. 4자리 PIN을 설정해주세요.
              </p>
            )}
            <input type="password" inputMode="numeric" maxLength={4} value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleSubmit()}
              placeholder="PIN 4자리"
              className="w-full border border-gray-200 rounded-xl px-3 py-4 text-center text-2xl tracking-[0.5em] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-mono" />
            <button onClick={handleSubmit} disabled={loading || pin.length !== 4}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm">
              {loading ? '...' : settingPin ? 'PIN 설정 완료' : '로그인'}
            </button>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 기록 화면 ───────────────────────────────────────────────────────────────

function RecordScreen({ session, onLogout, onUpdateSession }: {
  session: StudentSession; onLogout: () => void; onUpdateSession: (s: StudentSession) => void;
}) {
  const [hours, setHours] = useState<SubjectHours | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [showWrongOCR, setShowWrongOCR] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualHours, setManualHours] = useState<Record<string, { h: number; m: number }>>({
    math: { h: 0, m: 0 }, english: { h: 0, m: 0 }, korean: { h: 0, m: 0 },
    science: { h: 0, m: 0 }, etc: { h: 0, m: 0 },
  });

  // 목표 설정
  const [goalInput, setGoalInput] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');

  // 날짜/시간 체크
  const [recordInfo, setRecordInfo] = useState(getRecordInfo());
  const [alreadySubmitted, setAlreadySubmitted] = useState<number | null>(null);
  const [checkingRecord, setCheckingRecord] = useState(true);

  // 1초마다 시간 체크 (시간대 전환 감지)
  useEffect(() => {
    const t = setInterval(() => setRecordInfo(getRecordInfo()), 60_000);
    return () => clearInterval(t);
  }, []);

  // 해당 날짜 기록 존재 여부 체크
  useEffect(() => {
    if (!recordInfo.canSubmit) { setCheckingRecord(false); return; }
    setCheckingRecord(true);
    fetch(`/api/students/check-record?student_id=${session.id}&record_date=${recordInfo.recordDate}`)
      .then(r => r.json())
      .then(d => {
        setAlreadySubmitted(d.exists ? d.total_hours : null);
        setCheckingRecord(false);
      });
  }, [session.id, recordInfo.recordDate, recordInfo.canSubmit]);

  const applyManualHours = () => {
    const converted: SubjectHours = { math: 0, english: 0, korean: 0, science: 0, etc: 0 };
    for (const key of Object.keys(converted) as (keyof SubjectHours)[]) {
      const { h, m } = manualHours[key];
      converted[key] = Math.round((h + m / 60) * 10) / 10;
    }
    setHours(converted);
  };

  const handleGoalSave = async () => {
    const val = parseFloat(goalInput);
    if (!val || val <= 0) { setGoalError('올바른 목표를 입력해주세요.'); return; }
    setGoalSaving(true); setGoalError('');
    try {
      const res = await fetch('/api/students/update-goal', { cache: 'no-store', method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: session.id, total_goal: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...session, total_goal: data.total_goal, goal_edit_count: data.goal_edit_count };
      onUpdateSession(updated);
      setGoalInput('');
    } catch (e: unknown) {
      setGoalError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setGoalSaving(false);
    }
  };

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError(''); setConfidence(null); setHours(null); setShowWrongOCR(false); setResult(null); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/records/upload-screenshot', { cache: 'no-store', method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '분석 실패');
      setHours({ math: data.math ?? 0, english: data.english ?? 0, korean: data.korean ?? 0,
        science: (data.science ?? 0) + (data.social ?? 0), etc: data.etc ?? 0 });
      setConfidence(data.confidence ?? null);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : '이미지 분석에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1, multiple: false,
  });

  const handleSubmit = async () => {
    if (!hours || !recordInfo.canSubmit) return;
    setSubmitError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/records/submit', { cache: 'no-store', method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: session.id, record_date: recordInfo.recordDate, ...hours,
          input_method: manualMode ? 'manual_student' : 'screenshot',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출 실패');
      setResult(data);
      setAlreadySubmitted(data.total);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalHours = hours ? Math.round(Object.values(hours).reduce((a, b) => a + b, 0) * 10) / 10 : 0;
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = recordInfo.canSubmit ? (() => {
    const d = new Date(recordInfo.recordDate + 'T00:00:00');
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  })() : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-blue-900 text-white">
      {/* 헤더 */}
      <header className="px-4 pt-8 pb-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-blue-300 text-xs">매플 순공리그</p>
            <p className="text-white font-bold text-lg">안녕하세요, {session.name}님!</p>
            <p className="text-blue-400 text-xs">{session.school} {session.grade}</p>
          </div>
          <button onClick={onLogout} className="text-blue-400 text-xs border border-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-800">
            다른 학생
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-16 space-y-4">

        {/* 날짜 + 상태 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          {!recordInfo.canSubmit ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">⏰</p>
              <p className="text-gray-800 font-bold text-base">{recordInfo.message}</p>
              <p className="text-gray-500 text-sm mt-1">내일 오전 5시까지 입력할 수 있습니다</p>
            </div>
          ) : alreadySubmitted !== null ? (
            <div className="text-center py-4">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-800 font-bold text-base">{dateLabel} 기록 제출 완료</p>
              <p className="text-blue-600 font-extrabold text-2xl mt-1">{alreadySubmitted}h</p>
              <p className="text-gray-400 text-xs mt-2">수정이 필요하면 선생님께 말씀해주세요</p>
            </div>
          ) : checkingRecord ? (
            <div className="text-center py-4 text-gray-400 text-sm">확인 중...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-gray-800 font-bold text-base">오늘의 순공 기록</h2>
                <span className="text-blue-600 font-semibold text-sm">{dateLabel}</span>
              </div>
              <p className="text-gray-500 text-xs">열품타 스크린샷을 업로드하세요</p>
            </>
          )}
        </div>

        {/* 이하: 입력 가능하고 아직 제출 안 했을 때만 표시 */}
        {recordInfo.canSubmit && alreadySubmitted === null && !checkingRecord && (
          <>
            {/* 목표 설정 */}
            <GoalSettingCard session={session} goalInput={goalInput} setGoalInput={setGoalInput}
              goalSaving={goalSaving} goalError={goalError} onSave={handleGoalSave} />

            {/* 스크린샷 업로드 */}
            <div className="bg-white rounded-2xl p-5 shadow-lg">
              <h2 className="text-gray-800 font-bold text-base mb-3">열품타 스크린샷</h2>
              <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                <input {...getInputProps()} />
                {previewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="미리보기" className="max-h-48 mx-auto rounded-lg object-contain" />
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-lg gap-2">
                        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-blue-600 text-xs font-medium">AI가 시간을 분석 중...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-4xl mb-2">📸</div>
                    <p className="text-gray-600 text-sm font-medium">{isDragActive ? '여기에 놓으세요' : '탭해서 촬영 또는 파일 선택'}</p>
                    <p className="text-gray-400 text-xs mt-1">열품타 스크린샷을 올리면 자동 인식됩니다</p>
                  </>
                )}
              </div>
              {uploadError && <p className="text-red-500 text-xs text-center mt-2">{uploadError}</p>}
              {!hours && !uploading && !manualMode && (
                <button type="button" onClick={() => setManualMode(true)}
                  className="mt-2 w-full text-gray-400 text-xs underline underline-offset-2 hover:text-gray-600">
                  스크린샷 없이 직접 입력하기
                </button>
              )}
              {hours && !uploading && (
                <div className="mt-2 text-center space-y-1">
                  {confidence !== null && <p className="text-green-600 text-xs">✓ 인식 완료 (신뢰도 {Math.round(confidence * 100)}%)</p>}
                  {previewUrl && (
                    <button type="button" onClick={() => { setPreviewUrl(null); setHours(null); setConfidence(null); setShowWrongOCR(false); }}
                      className="text-blue-500 text-xs underline underline-offset-2">다른 사진으로 다시 업로드</button>
                  )}
                </div>
              )}
            </div>

            {/* OCR 결과 */}
            {hours && !uploading && (
              <div className="bg-white rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-gray-800 font-bold text-base">인식된 공부 시간</h2>
                  <span className="text-2xl font-extrabold text-blue-700">{totalHours}h</span>
                </div>
                <div className="space-y-2">
                  {SUBJECTS.map(({ key, label, badge }) => {
                    const hasH = hours[key] > 0;
                    return (
                      <div key={key} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${hasH ? badge : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                        <span className={`font-medium text-sm ${hasH ? '' : 'text-gray-400'}`}>{label}</span>
                        <span className={`font-bold text-base tabular-nums ${hasH ? '' : 'text-gray-300'}`}>{hours[key]}h</span>
                      </div>
                    );
                  })}
                </div>
                {totalHours > 0 && (
                  <div className="mt-4 flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-100">
                    {SUBJECTS.map(({ key, bar }) => {
                      const w = (hours[key] / totalHours) * 100;
                      return w > 0 ? <div key={key} className={bar} style={{ width: `${w}%` }} /> : null;
                    })}
                  </div>
                )}
                <div className="mt-4 text-center">
                  {!showWrongOCR ? (
                    <button type="button" onClick={() => setShowWrongOCR(true)}
                      className="text-gray-400 text-xs underline underline-offset-2 hover:text-gray-600">인식이 잘못됐나요?</button>
                  ) : !manualMode ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 space-y-2">
                      <p>선생님께 말씀하거나 직접 수정할 수 있어요 🙋</p>
                      <button type="button" onClick={() => setManualMode(true)}
                        className="text-blue-600 text-xs font-semibold underline underline-offset-2">직접 시간 입력하기</button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* 수동 입력 모드 */}
            {manualMode && (
              <div className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 font-medium">
                  ⚠️ 수동 기록은 선생님이 확인합니다
                </div>
                <h2 className="text-gray-800 font-bold text-base">직접 시간 입력</h2>
                {SUBJECTS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 w-16">{label}</span>
                    <select value={manualHours[key].h} onChange={e => setManualHours(prev => ({ ...prev, [key]: { ...prev[key], h: Number(e.target.value) } }))}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 bg-gray-50 w-[4.5rem] min-h-[44px]">
                      {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i}시간</option>)}
                    </select>
                    <select value={manualHours[key].m} onChange={e => setManualHours(prev => ({ ...prev, [key]: { ...prev[key], m: Number(e.target.value) } }))}
                      className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-gray-800 bg-gray-50 w-[4.5rem] min-h-[44px]">
                      {[0, 10, 15, 20, 30, 40, 45, 50].map(m => <option key={m} value={m}>{m}분</option>)}
                    </select>
                    <span className="text-xs text-gray-400 tabular-nums">
                      = {Math.round((manualHours[key].h + manualHours[key].m / 60) * 10) / 10}h
                    </span>
                  </div>
                ))}
                <button type="button" onClick={applyManualHours}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm">
                  이 시간으로 적용하기
                </button>
              </div>
            )}

            {/* 제출 */}
            {submitError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm text-center">{submitError}</div>}
            {!result && (
              <button onClick={handleSubmit} disabled={!hours || submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-bold py-4 rounded-2xl text-base shadow-lg">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />제출 중...
                  </span>
                ) : !hours ? '스크린샷을 먼저 업로드하세요' : `${dateLabel} 순공 ${totalHours}h 제출하기`}
              </button>
            )}

            {/* 결과 */}
            {result && (
              <div className="bg-white rounded-2xl p-6 shadow-lg text-center space-y-4">
                <div className="text-5xl">{result.tier?.emoji ?? '🏆'}</div>
                {result.tier && (
                  <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold text-white" style={{ backgroundColor: result.tier.color ?? '#3B82F6' }}>
                    {result.tier.name}
                  </span>
                )}
                <div>
                  <p className="text-3xl font-extrabold text-gray-900">{result.total}h</p>
                  <p className="text-gray-500 text-sm mt-0.5">{dateLabel} 순공 시간</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl py-3 px-4">
                    <p className="text-2xl font-extrabold text-blue-700">{result.rank}위</p>
                    <p className="text-xs text-blue-500 mt-0.5">전체 {result.total_students}명 중</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl py-3 px-4">
                    <p className="text-2xl font-extrabold text-blue-700">{result.daily_avg}h</p>
                    <p className="text-xs text-blue-500 mt-0.5">일평균 순공</p>
                  </div>
                </div>
                {result.total_goal > 0 && (
                  <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <GoalProgressBars seasonProgress={result.season_progress} achievement={result.achievement}
                      totalGoal={result.total_goal} accumulated={result.accumulated} />
                    <p className="text-xs text-gray-500 mt-2">앞으로 하루 <strong className="text-gray-700">{result.daily_required}h</strong>씩 필요</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── 목표 설정 카드 ──────────────────────────────────────────────────────────

function GoalSettingCard({ session, goalInput, setGoalInput, goalSaving, goalError, onSave }: {
  session: StudentSession;
  goalInput: string; setGoalInput: (v: string) => void;
  goalSaving: boolean; goalError: string; onSave: () => void;
}) {
  const editCount = session.goal_edit_count ?? 0;
  const hasGoal = (session.total_goal ?? 0) > 0 && editCount > 0;

  if (editCount >= 2) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-gray-800 font-bold text-base">시즌 목표</h2>
          <span className="text-2xl font-extrabold text-blue-700">{session.total_goal}h</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">목표 변경은 선생님께 문의하세요</p>
      </div>
    );
  }

  if (hasGoal) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-gray-800 font-bold text-base">시즌 목표</h2>
          <span className="text-2xl font-extrabold text-blue-700">{session.total_goal}h</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" step="10" min={session.total_goal + 1} placeholder={`${session.total_goal}h보다 높게`}
            value={goalInput} onChange={e => setGoalInput(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={onSave} disabled={goalSaving}
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-500 disabled:opacity-50">
            {goalSaving ? '...' : '목표 상향'}
          </button>
        </div>
        {goalError && <p className="text-red-500 text-xs">{goalError}</p>}
        <p className="text-xs text-gray-400">목표 상향은 1번만 가능합니다</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-lg space-y-3">
      <h2 className="text-gray-800 font-bold text-base">시즌 총 목표 설정</h2>
      <p className="text-gray-500 text-sm">이번 시즌 동안 달성할 총 공부 시간을 설정해주세요</p>
      <div className="flex items-center gap-2">
        <input type="number" step="10" min="100" placeholder="예: 500" value={goalInput}
          onChange={e => setGoalInput(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-500 text-sm font-medium">시간</span>
        <button onClick={onSave} disabled={goalSaving}
          className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-500 disabled:opacity-50">
          {goalSaving ? '...' : '설정'}
        </button>
      </div>
      {goalError && <p className="text-red-500 text-xs">{goalError}</p>}
    </div>
  );
}
