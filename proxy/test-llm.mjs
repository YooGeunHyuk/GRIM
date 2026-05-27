// T3 테스트 — 일기(한글) → LLM → 영어 장면 JSON.
// 새 키 없이 기존 FAL 키로 fal-ai/any-llm 호출.
// 실행: cd proxy && node --env-file=.env.local test-llm.mjs

const FAL_KEY = process.env.FAL_KEY;
// 장면 추출용 LLM — 비싸지 않으면서 한글 이해 좋은 모델. 안 먹으면 에러로 알려줌.
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-pro-1.5';

if (!FAL_KEY) {
  console.error('❌ FAL_KEY 없음 — proxy/.env.local 확인');
  process.exit(1);
}

const diary = '비 온 뒤 맑게 갠 하늘, 커피 한 잔, 회사 강아지와의 산책. 마음속 답답함이 천천히 내려가는 기분이었다.';

const system = `You convert a Korean diary entry into a concise English visual scene for an illustration.
Output ONLY a JSON object (no markdown, no commentary) with keys:
"scene" (one vivid English sentence of the main visual scene),
"mood", "time", "weather", "location",
"subjects" (array of strings), "objects" (array of strings),
"palette" (color guidance), "composition" (framing guidance).
Stay grounded in the diary. Do NOT invent a clear face for the writer — prefer a back view, distant figure, or scene-focused framing.`;

console.log('→ LLM 모델:', LLM_MODEL);
console.log('→ 일기:', diary, '\n');

const res = await fetch('https://fal.run/fal-ai/any-llm', {
  method: 'POST',
  headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: LLM_MODEL,
    system_prompt: system,
    prompt: diary,
  }),
});

console.log('← status:', res.status);
const data = await res.json().catch(() => ({}));

// any-llm 응답은 보통 { output: "..." } — 원문도 같이 보여줘서 구조 확인
const output = data?.output ?? data?.text ?? '';
if (output) {
  console.log('\n✅ LLM 출력:\n', output);
  console.log('\n--- JSON 파싱 시도 ---');
  try {
    const cleaned = String(output).replace(/```json|```/g, '').trim();
    console.log(JSON.parse(cleaned));
  } catch (e) {
    console.log('파싱 실패(폴백 필요):', e.message);
  }
} else {
  console.log('\n⚠️ output 없음 — 응답 원문:');
  console.log(JSON.stringify(data, null, 2).slice(0, 1800));
}
