import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── 과목 분류 맵 ──────────────────────────────────────────────────────────

const SUBJECT_MAP: Record<string, string> = {
  // 수학
  '수학': 'math', '수1': 'math', '수2': 'math', '수학1': 'math', '수학2': 'math',
  '미적': 'math', '미적분': 'math', '미적분1': 'math', '미적분2': 'math',
  '미1': 'math', '미2': 'math',
  '확통': 'math', '확률과통계': 'math', '확률': 'math', '통계': 'math', '확과통': 'math',
  '기하': 'math', '대수': 'math',
  '공수': 'math', '공수1': 'math', '공수2': 'math',
  '공통수학': 'math', '공통수학1': 'math', '공통수학2': 'math',
  '심화수학': 'math', '기본수학': 'math', '경제수학': 'math', '수학과제탐구': 'math',
  '수상': 'math', '수하': 'math', '수나': 'math', '수가': 'math',
  '기벡': 'math', '기하와벡터': 'math', '경우의수': 'math',
  '미분': 'math', '적분': 'math', '행렬': 'math',

  // 영어
  '영어': 'english', '영1': 'english', '영2': 'english', '영어1': 'english', '영어2': 'english',
  '영독': 'english', '영어독해': 'english', '영독해': 'english',
  '영작': 'english', '영어작문': 'english', '영어회화': 'english',
  '기본영어': 'english', '심화영어': 'english', '영어듣기': 'english',
  '영문': 'english', '영단어': 'english', '영어단어': 'english',
  '리딩': 'english', '리스닝': 'english',
  '영문법': 'english', '구문': 'english', '영듣': 'english',
  '토플': 'english', '토익': 'english', '텝스': 'english',

  // 국어
  '국어': 'korean', '국1': 'korean', '국2': 'korean', '국어1': 'korean', '국어2': 'korean',
  '문학': 'korean', '독서': 'korean', '언매': 'korean', '언메': 'korean', '언어와매체': 'korean',
  '화작': 'korean', '화법과작문': 'korean', '독서와문법': 'korean',
  '기본국어': 'korean', '심화국어': 'korean',
  '국문법': 'korean', '비문학': 'korean', '비문': 'korean',
  '현대문학': 'korean', '고전문학': 'korean', '고전': 'korean',
  '현대시': 'korean', '고전시': 'korean', '소설': 'korean',
  '매체': 'korean', '화법': 'korean', '작문': 'korean', '독문': 'korean',

  // 과학 (자연과학)
  '과학': 'science', '과탐': 'science', '탐구': 'science',
  '물리': 'science', '물리학': 'science',
  '물리1': 'science', '물리2': 'science', '물리학1': 'science', '물리학2': 'science',
  '물1': 'science', '물2': 'science',
  '화학': 'science', '화학1': 'science', '화학2': 'science',
  '화1': 'science', '화2': 'science',
  '생물': 'science', '생명': 'science', '생명과학': 'science',
  '생명과학1': 'science', '생명과학2': 'science',
  '생1': 'science', '생2': 'science', '생과': 'science', '생과1': 'science', '생과2': 'science',
  '지구': 'science', '지구과학': 'science', '지구과학1': 'science', '지구과학2': 'science',
  '지학': 'science', '지과': 'science', '지과1': 'science', '지과2': 'science',
  '지1': 'science', '지2': 'science',
  '통합과학': 'science', '과학탐구': 'science',

  // 사탐 (사회탐구)
  '사회': 'social', '사탐': 'social', '한국사': 'social', '한사': 'social',
  '세계사': 'social', '세사': 'social', '동아시아사': 'social', '동사': 'social',
  '경제': 'social', '정치와법': 'social', '정법': 'social', '정치': 'social',
  '사회문화': 'social', '사문': 'social',
  '생활과윤리': 'social', '생윤': 'social', '윤리와사상': 'social', '윤사': 'social',
  '세계지리': 'social', '세지': 'social', '한국지리': 'social', '한지': 'social',
  '통합사회': 'social', '통사': 'social', '통과': 'social',
  '법과정치': 'social', '법정': 'social',

  // 기타
  '논술': 'etc', '자습': 'etc', '비교과': 'etc', '체육': 'etc',
  '한문': 'etc', '한자': 'etc', '정보': 'etc', '코딩': 'etc', '음악': 'etc', '미술': 'etc',
  '제2외국어': 'etc', '일본어': 'etc', '중국어': 'etc',
  '프랑스어': 'etc', '독일어': 'etc', '스페인어': 'etc',
  '아랍어': 'etc', '러시아어': 'etc', '베트남어': 'etc',
};

function classifySubject(name: string): string {
  const n = name.trim();
  // 1. 정확 매칭
  if (SUBJECT_MAP[n]) return SUBJECT_MAP[n];
  // 2. 키워드 includes — "내신수학"→math, "기출영어"→english 등
  if (/수학|미적|확통|기하/.test(n)) return 'math';
  if (/영어|토익|토플|텝스/.test(n)) return 'english';
  if (/국어|문학|독서/.test(n)) return 'korean';
  if (/물리|화학|생명|생물|지구|통합과학|과탐/.test(n)) return 'science';
  if (/사회|한국사|윤리|지리|경제|정치|세계사|동아시아/.test(n)) return 'social';
  // 3. 부분 매칭 (SUBJECT_MAP 키 포함 여부)
  for (const [key, value] of Object.entries(SUBJECT_MAP)) {
    if (n.includes(key)) return value;
  }
  return 'etc';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(text: string): any {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) return JSON.parse(block[1].trim());
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('JSON을 찾을 수 없습니다.');
}

const snap = (n: number) => Math.round(n * 10) / 10;

// ─── API ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) return Response.json({ error: '이미지가 없습니다.' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mediaType = file.type.startsWith('image/') ? file.type : 'image/jpeg';

    // ANTHROPIC_API_KEY 없으면 mock 반환
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({
        math: 2, english: 1.5, korean: 1, science: 0.5, etc: 0,
        total: 5, confidence: 0, mock: true, raw_subjects: [],
      });
    }

    // ── 1단계: Claude Vision — 순수 OCR만 ──
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            source: { type: 'base64', media_type: mediaType as any, data: base64 },
          },
          {
            type: 'text',
            text: `이 열품타 스크린샷에서 각 과목의 이름과 공부 시간을 그대로 추출해줘.
과목 분류하지 말고, 화면에 보이는 과목명과 시간을 있는 그대로 적어.

시간 변환 규칙:
- 시:분:초 형식이면 소수점 시간으로 변환
- 0:43:25 → 43분 → 0.7h
- 1:51:48 → 111분 → 1.9h
- 계산: (시간×60+분)/60, 소수점 1자리 반올림

상단의 총 시간도 함께 추출해.

JSON만 응답 (설명 없이):
{"subjects": [{"name": "과목명", "hours": 0.0}], "total_from_screen": 0.0, "confidence": "high|medium|low"}`,
          },
        ],
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = extractJson(text);

    const subjects: { name: string; hours: number }[] = parsed.subjects ?? [];
    const totalFromScreen = snap(parsed.total_from_screen ?? 0);

    // ── 2단계: 서버에서 과목 분류 (정확도 100%) ──
    const totals = { math: 0, english: 0, korean: 0, science: 0, social: 0, etc: 0 };
    const rawSubjects: { name: string; hours: number; mapped_to: string }[] = [];

    for (const s of subjects) {
      const hours = snap(s.hours ?? 0);
      if (hours <= 0) continue;
      const category = classifySubject(s.name);
      totals[category as keyof typeof totals] += hours;
      rawSubjects.push({ name: s.name, hours, mapped_to: category });
    }

    // 반올림 정리
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[k] = snap(totals[k]);
    }
    const total = snap(totals.math + totals.english + totals.korean + totals.science + totals.social + totals.etc);

    // confidence 계산
    const confMap: Record<string, number> = { high: 1, medium: 0.7, low: 0.4 };
    let conf = typeof parsed.confidence === 'string' ? (confMap[parsed.confidence] ?? 0.7) : 0.7;
    // 합계 검증 — 차이 0.3h 이상이면 low
    if (totalFromScreen > 0 && Math.abs(total - totalFromScreen) >= 0.3) {
      conf = Math.min(conf, 0.4);
    }

    return Response.json({
      ...totals,
      total,
      confidence: conf,
      raw_subjects: rawSubjects,
    });
  } catch (e: unknown) {
    console.error(e);
    return Response.json({ error: e instanceof Error ? e.message : '분석에 실패했습니다.' }, { status: 500 });
  }
}
