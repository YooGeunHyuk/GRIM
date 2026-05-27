// Flux Pro Ultra Redux img2img — 레퍼런스 스타일 전이 테스트.
// 같은 일기·레퍼런스로 strength 3종 (0.5 / 0.7 / 0.85) 호출해 비교.
// 사용: cd proxy && node --env-file=.env.local test-crayon-redux.mjs

const FAL_KEY = process.env.FAL_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-pro-1.5';
const REDUX_MODEL = 'fal-ai/flux-pro/v1.1-ultra/redux';
const REF_URL =
  process.env.KID_REF_URL ||
  'https://v3b.fal.media/files/b/0a9bd261/KYwFyUIWv9-zhej4_5Wlu_goose.jpeg';
if (!FAL_KEY) { console.error('❌ FAL_KEY 없음'); process.exit(1); }

const diary =
  '오늘은 모처럼 일찍 눈이 떠졌다. 강아지 목줄을 챙겨 공원으로 향했다. 아침 공기가 제법 쌀쌀했지만 하늘은 더없이 맑았다. 벤치에 앉아 커피를 홀짝이며 이 여유를 만끽했다.';

// Redux는 image가 스타일 결정 → prompt는 짧은 내용 가이드만
const system = `Convert this Korean diary into ONE concise English visual scene sentence (max 30 words) for a child-style drawing. Output ONLY plain text, no JSON. Describe the single most evocative scene — what is in the foreground, the action, key surrounding elements. Stay grounded in the diary.`;

console.log('① 일기 → LLM 장면 한 문장...');
const llmRes = await fetch('https://fal.run/fal-ai/any-llm', {
  method: 'POST',
  headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: LLM_MODEL, system_prompt: system, prompt: diary }),
});
const llmData = await llmRes.json().catch(() => ({}));
const sceneText = String(llmData?.output ?? llmData?.text ?? '').trim().replace(/^["']|["']$/g, '');
console.log('  scene:', sceneText);

// 스타일은 레퍼런스에서 추출 → 프롬프트는 내용 + 짧은 톤 힌트만
const prompt = `${sceneText} Drawn in the style of a Korean elementary school child's marker and watercolor drawing — lines drawn SLOWLY and CAREFULLY by a concentrating kid, wobbly and jagged because of tiny unsteady fingers, NOT because of fast gestural strokes. Each line looks paused and deliberate but uneven, no smooth flowing motion. Avoid: sketchy, gestural, dynamic strokes, quick brushwork, calligraphic flow.`;
console.log('\n② 프롬프트 (', prompt.length, '자 ):', prompt);
console.log('\n③ 레퍼런스:', REF_URL);

async function generate(strength) {
  const res = await fetch(`https://fal.run/${REDUX_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_url: REF_URL,
      image_prompt_strength: strength,
      aspect_ratio: '4:3',
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '6',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { strength, error: `${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
  const url = data?.images?.[0]?.url || data?.image?.url;
  return { strength, url, error: url ? null : JSON.stringify(data).slice(0, 200) };
}

console.log('\n④ Redux 3장 생성 중 (~30초)...');
// 0.7 주변 미세조정 — 0.65 / 0.7 / 0.75
const results = await Promise.all([0.65, 0.7, 0.75].map(generate));

console.log('\n✅ 결과:');
for (const r of results) {
  if (r.url) console.log(`  strength=${r.strength}: ${r.url}`);
  else console.log(`  strength=${r.strength}: ❌ ${r.error}`);
}
