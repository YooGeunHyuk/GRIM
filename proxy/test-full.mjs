// 전체 파이프라인 테스트 — 일기(한글) → LLM 장면 JSON → 프롬프트 → flux-2-pro → 이미지.
// 실행: cd proxy && node --env-file=.env.local test-full.mjs

const FAL_KEY = process.env.FAL_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-pro-1.5';
const IMG_MODEL = process.env.FAL_MODEL || 'fal-ai/flux-2-pro';
if (!FAL_KEY) { console.error('❌ FAL_KEY 없음'); process.exit(1); }

const diary = '비 온 뒤 맑게 갠 하늘, 커피 한 잔, 회사 강아지와의 산책. 마음속 답답함이 천천히 내려가는 기분이었다.';
const style = 'watercolor';

const STYLE = {
  watercolor: 'Genuine traditional watercolor painting on cold-pressed paper, transparent pigment washes, soft feathered edges, visible paper grain, luminous and semi-transparent. Rendered as a physical watercolor, not digital.',
  cartoon: 'Detailed observational watercolor and fine ink illustration. Flat controlled color washes with crisp edges and delicate ink linework, densely textured surfaces, muted natural palette, generous white paper. Hand-painted, no heavy blending, no glow.',
  pendrawing: 'Black ink pen drawing on white paper, urban sketch style, fine confident linework with cross-hatching, monochrome black and white, generous white paper, visible paper grain. No color, no wash, no gradient.',
};
const NEG = 'no text, no signage text, no letters, no watermark, no signature';

const system = `You convert a Korean diary entry into a concise English visual scene for an illustration.
Output ONLY a JSON object (no markdown) with keys: "scene","mood","time","weather","location","subjects"(array),"objects"(array),"palette","composition".
Stay grounded in the diary. Do NOT invent a clear face for the writer — prefer a back view, distant figure, or scene-focused framing.`;

// 1) 일기 → 장면 JSON
console.log('① 일기 → LLM 장면 해석...');
const llmRes = await fetch('https://fal.run/fal-ai/any-llm', {
  method: 'POST',
  headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: LLM_MODEL, system_prompt: system, prompt: diary }),
});
const llmData = await llmRes.json().catch(() => ({}));
const raw = llmData?.output ?? llmData?.text ?? '';

let scene;
try {
  scene = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
} catch {
  console.log('  JSON 파싱 실패 → 일기 원문으로 폴백');
  scene = { scene: diary, mood: 'calm, warm', palette: '', composition: '' };
}
console.log('  scene:', scene.scene);

// 2) 장면 JSON → 이미지 프롬프트 조립
const sceneText = [scene.scene, scene.subjects?.join(', '), scene.objects?.join(', '), scene.time, scene.weather, scene.location]
  .filter(Boolean).join('. ');
const prompt = `${sceneText}. ${STYLE[style]} Mood: ${scene.mood || 'calm, warm'}. Palette: ${scene.palette || ''}. ${scene.composition || ''}. ${NEG}.`;
console.log('\n② 프롬프트 조립 완료 (', prompt.length, '자 )');

// 3) 프롬프트 → flux-2-pro
console.log('\n③ flux-2-pro 그림 생성... (~10초)');
const imgRes = await fetch(`https://fal.run/${IMG_MODEL}`, {
  method: 'POST',
  headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, image_size: 'landscape_4_3', num_images: 1 }),
});
const imgData = await imgRes.json().catch(() => ({}));
const url = imgData?.images?.[0]?.url || imgData?.image?.url;

if (url) {
  console.log('\n✅ 전체 파이프라인 성공! 이 일기가 그림이 됐어요:\n', url);
} else {
  console.log('\n⚠️ 이미지 실패 — 응답:', JSON.stringify(imgData).slice(0, 600));
}
