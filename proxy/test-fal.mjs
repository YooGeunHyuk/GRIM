// 로컬 테스트 — vercel 없이 fal 호출만 확인한다.
// 실행: cd proxy && node --env-file=.env.local test-fal.mjs
//
// 성공하면 마지막에 imageUrl 이 찍힌다. 에러면 status + 응답을 그대로 보여줘서
// (예: 잘못된 파라미터) 무엇을 고쳐야 할지 알 수 있다.

const FAL_KEY = process.env.FAL_KEY;
const MODEL = process.env.FAL_MODEL || 'fal-ai/flux-2-pro';

if (!FAL_KEY) {
  console.error('❌ FAL_KEY 없음 — proxy/.env.local 에 FAL_KEY=... 넣었는지 확인');
  process.exit(1);
}

const diary = '비 온 뒤 맑게 갠 하늘, 커피 한 잔, 강아지와 산책';
const watercolor =
  'Genuine traditional watercolor painting on cold-pressed paper. Transparent pigment washes layered light to dark, soft feathered edges where colors bleed, visible paper grain, luminous and semi-transparent, gentle color transitions and soft atmospheric light. Rendered as a physical watercolor, not digital.';
const NEG = 'no text, no signage text, no letters, no watermark, no signature';
const prompt = `${diary}. ${watercolor} Mood: calm, warm, emotional. ${NEG}.`;

console.log('→ 모델:', MODEL);
console.log('→ 프롬프트:', prompt.slice(0, 90), '...\n');

const res = await fetch(`https://fal.run/${MODEL}`, {
  method: 'POST',
  headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt,
    image_size: 'landscape_4_3', // ← flux-2-pro에서 안 먹으면 에러로 알려줌
    num_images: 1,
  }),
});

console.log('← status:', res.status);
const data = await res.json().catch(() => ({}));

const url = data?.images?.[0]?.url || data?.image?.url;
if (url) {
  console.log('\n✅ 성공! imageUrl:\n', url);
} else {
  console.log('\n⚠️ 이미지 URL 없음 — 응답 원문:');
  console.log(JSON.stringify(data, null, 2).slice(0, 1800));
}
