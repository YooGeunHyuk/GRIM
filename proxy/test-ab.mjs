// A/B 테스트 스크립트 — 수채화 STYLE_MAP·LLM_SYSTEM 강화 (NEW) vs 현재 (OLD)
//
// 동작:
//   1) diaries-ab.json 의 일기 7편 읽음
//   2) 각 일기마다 OLD/NEW 둘 다 LLM(any-llm) → scene JSON → flux-2-pro 이미지
//   3) 결과를 ab-results-{timestamp}/ 에 저장 + 비교 HTML
//   4) 본인이 HTML 열어서 페어별로 5점 (1=현재 더 좋음, 5=강화 더 좋음)
//
// 사용:
//   1) diaries-ab.json 채우기 (본인 일기 7편)
//   2) FAL_KEY 환경변수 또는 proxy/.env.local
//   3) node proxy/test-ab.mjs
//
// 통과 기준: 7편 중 5편 이상이 4점 이상 → 강화 NEW 채택

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// FAL_KEY 로딩 — env or .env.local
async function loadFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  const envPath = join(__dirname, '.env.local');
  if (existsSync(envPath)) {
    const text = await readFile(envPath, 'utf8');
    const m = text.match(/^FAL_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('FAL_KEY 못 찾음. env 또는 proxy/.env.local 확인');
}

const FAL_BASE = 'https://fal.run';
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-pro-1.5';
const IMG_MODEL = process.env.FAL_MODEL || 'fal-ai/flux-2-pro';

// ─────────────────────────────────────────────────────────
// OLD — 현재 운영 중 (proxy/api/generate.ts 강화 직전 버전)
// ─────────────────────────────────────────────────────────
const OLD_STYLE_MAP_WATERCOLOR =
  'Genuine traditional watercolor painting on cold-pressed paper. Transparent pigment washes layered light to dark, soft feathered edges where colors bleed, visible paper grain, luminous and semi-transparent, gentle color transitions and soft atmospheric light. Rendered as a physical watercolor, not digital.';

const OLD_LLM_SYSTEM = `You convert a Korean diary entry into a concise English visual scene for an illustration.
Output ONLY a JSON object (no markdown, no commentary) with keys:
"scene" (one vivid English sentence of the main visual scene),
"mood","time","weather","location",
"subjects" (array of strings), "objects" (array of strings),
"palette" (color guidance), "composition" (framing guidance).
Stay grounded in the diary. Do NOT invent a clear face for the writer — prefer a back view, distant figure, or scene-focused framing.`;

// ─────────────────────────────────────────────────────────
// NEW — 강화 (T1·T2 적용)
// ─────────────────────────────────────────────────────────
const NEW_STYLE_MAP_WATERCOLOR =
  'Lyrical traditional watercolor painting on cold-pressed cotton paper. Painterly, atmospheric, emotionally warm. Built in transparent pigment washes: pale wet-on-wet atmospheric underwash for sky and ambient light, mid-tone glazes for shapes, a few darker accent strokes for depth. Soft feathered edges with gentle color bleeds, visible paper grain, granulation in pigment, occasional bloom where wet pigment meets damp paper. Luminous semi-transparent layers with paper-white showing through. Rich detail in environment (foliage, architecture, sky, light), not minimal. Warm sun-warmed palette of ochre, soft coral, dusty rose, sage, slate blue. Hand-painted brush strokes visible. Looks like a physical watercolor in a sketchbook, full of atmosphere and feeling. Avoid: hard digital edges, vector flatness, airbrush blur, oversaturation, neon colors, photorealism, empty backgrounds, sparse minimal scenes.';

const NEW_LLM_SYSTEM = `You convert a Korean diary entry into a concise English visual scene for an illustration. The scene must capture the FEELING of the diary as one image.

Output ONLY a JSON object (no markdown, no commentary) with keys:
"scene" (one vivid English sentence of the visual scene),
"chosen_moment" (short Korean quote from the diary identifying which sentence/fragment or overall setting you focused on),
"mood","time","weather","location",
"subjects" (array of strings), "objects" (array of strings),
"palette" (color guidance), "composition" (framing guidance — wide shot, medium, close-up).

SCENE SELECTION — choose ONE of these two modes based on the diary:

  MODE 1 — Whole-scene (preferred when diary describes a single coherent location/setting):
    Render the whole environment as the subject. Wide or medium shot. Include the
    atmospheric details that make the place specific (autumn maples through the cafe
    window, orange sunset over the sea, rain-streaked window with warm interior light,
    leaf-covered park path with golden light). The writer is a small distant figure or
    absent.
    Examples that fit MODE 1: "cafe corner with autumn leaves outside", "beach at sunset",
    "rainy day reading by window", "fall park path with people walking".

  MODE 2 — Single-moment close-up (preferred when diary describes many disparate events
    and no single setting dominates):
    Pick the SINGLE most emotionally weighted moment. Close-up of an object, hand, or
    one quiet image (the cat under the streetlamp, the steaming cup on the bench, the
    sketchbook on the table). Helpful tiebreakers when picking:
      (a) sensory detail (touch, light, smell, specific object) beats event summary
      (b) the moment paired with the strongest emotion-laden Korean adjective
          (따뜻한, 쓸쓸한, 반짝이는, 노곤한, 설렘 등)

DEFAULT TO MODE 1 unless the diary clearly jumps between many places/events with no
single dominant setting. Include atmospheric and supporting details liberally — empty
backgrounds make watercolor feel sparse and lonely.

GROUNDING — Stay grounded in the diary. Do NOT invent facts the diary doesn't state.
PERSONA — Do NOT invent a clear face for the writer. Prefer a back view, distant figure,
or scene-focused framing.`;

const NEGATIVE = 'no text, no signage text, no letters, no watermark, no signature';

function assemblePrompt(scene, styleDesc) {
  const sceneText = [
    scene.scene,
    scene.subjects?.join(', '),
    scene.objects?.join(', '),
    scene.time,
    scene.weather,
    scene.location,
  ]
    .filter(Boolean)
    .join('. ');
  return `${sceneText}. ${styleDesc} Mood: ${scene.mood || 'calm, warm, emotional'}. Palette: ${
    scene.palette || ''
  }. ${scene.composition || ''}. ${NEGATIVE}.`;
}

async function interpretDiary(diary, system, FAL_KEY) {
  const res = await fetch(`${FAL_BASE}/fal-ai/any-llm`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, system_prompt: system, prompt: diary }),
  });
  if (!res.ok) throw new Error(`any-llm ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data?.output ?? data?.text ?? '';
  return JSON.parse(String(raw).replace(/```json|```/g, '').trim());
}

async function generateImage(prompt, FAL_KEY) {
  const res = await fetch(`${FAL_BASE}/${IMG_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_4_3',
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: false,
    }),
  });
  if (!res.ok) throw new Error(`flux ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.images?.[0]?.url || data?.image?.url || null;
}

async function runOne(diary, system, styleDesc, FAL_KEY) {
  const scene = await interpretDiary(diary, system, FAL_KEY);
  const prompt = assemblePrompt(scene, styleDesc);
  const url = await generateImage(prompt, FAL_KEY);
  return { scene, prompt, url };
}

function htmlReport(results, outDir) {
  const css = `
    body { font-family: -apple-system, sans-serif; background: #FBF6EE; color: #3A2E25; max-width: 1100px; margin: 0 auto; padding: 32px 16px; }
    h1 { font-size: 22px; }
    .pair { background: #FFFDF8; border: 1px solid #ECE2D3; border-radius: 14px; padding: 16px; margin-bottom: 28px; }
    .pair h2 { margin-top: 0; font-size: 16px; }
    .diary { font-size: 14px; line-height: 1.7; white-space: pre-wrap; background: #FBF6EE; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .col { background: #FBF6EE; padding: 12px; border-radius: 8px; }
    .col h3 { margin-top: 0; font-size: 13px; color: #9B8979; }
    .col img { width: 100%; border-radius: 8px; display: block; margin-bottom: 8px; }
    .meta { font-size: 11px; color: #9B8979; }
    .err { color: #C97B4A; }
    .summary { background: #FFFDF8; border: 1px solid #C97B4A; border-radius: 14px; padding: 16px; margin-bottom: 28px; }
  `;
  const total = results.length;
  const okCount = results.filter((r) => r.old?.url && r.new?.url).length;

  const items = results
    .map((r, i) => {
      const old = r.old?.url
        ? `<img src="${r.old.url}" alt="OLD" />`
        : `<p class="err">OLD 실패: ${r.old?.error || '?'}</p>`;
      const neu = r.new?.url
        ? `<img src="${r.new.url}" alt="NEW" />`
        : `<p class="err">NEW 실패: ${r.new?.error || '?'}</p>`;
      const oldMoment = r.old?.scene?.chosen_moment ?? '(없음)';
      const newMoment = r.new?.scene?.chosen_moment ?? '(없음)';
      return `
        <div class="pair">
          <h2>일기 ${i + 1} (${r.id} / ${r.date})</h2>
          <div class="diary">${r.content}</div>
          <div class="cols">
            <div class="col">
              <h3>OLD (현재 운영)</h3>
              ${old}
              <p class="meta">scene: ${r.old?.scene?.scene ?? '?'}</p>
              <p class="meta">chosen_moment: ${oldMoment}</p>
            </div>
            <div class="col">
              <h3>NEW (강화)</h3>
              ${neu}
              <p class="meta">scene: ${r.new?.scene?.scene ?? '?'}</p>
              <p class="meta">chosen_moment: ${newMoment}</p>
            </div>
          </div>
          <p class="meta">본인 점수 (1=OLD 더 좋음 / 3=동일 / 5=NEW 더 좋음): ___</p>
        </div>
      `;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>GRIM A/B (${outDir})</title><style>${css}</style></head>
<body>
  <h1>GRIM 수채화 A/B 비교</h1>
  <div class="summary">
    <p>총 ${total}편 중 ${okCount}편 두 결과 모두 성공.</p>
    <p>본인 채점 후 5/7 이상 4점+ = NEW 채택. 미만 = STYLE_MAP 다른 패턴 재시도 (3회 한도) 또는 C escalate.</p>
  </div>
  ${items}
</body>
</html>`;
}

async function main() {
  const FAL_KEY = await loadFalKey();

  const diariesPath = join(__dirname, 'diaries-ab.json');
  const { diaries } = JSON.parse(await readFile(diariesPath, 'utf8'));
  if (!Array.isArray(diaries) || diaries.length === 0) {
    throw new Error('diaries-ab.json에 일기가 없음');
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(__dirname, `ab-results-${ts}`);
  await mkdir(outDir, { recursive: true });

  const results = [];
  for (const d of diaries) {
    process.stdout.write(`[${d.id}] OLD ... `);
    let oldRes = {};
    try {
      const r = await runOne(d.content, OLD_LLM_SYSTEM, OLD_STYLE_MAP_WATERCOLOR, FAL_KEY);
      oldRes = r;
      process.stdout.write(`OK  NEW ... `);
    } catch (e) {
      oldRes = { error: e.message };
      process.stdout.write(`FAIL(${e.message})  NEW ... `);
    }
    let newRes = {};
    try {
      const r = await runOne(d.content, NEW_LLM_SYSTEM, NEW_STYLE_MAP_WATERCOLOR, FAL_KEY);
      newRes = r;
      console.log('OK');
    } catch (e) {
      newRes = { error: e.message };
      console.log(`FAIL(${e.message})`);
    }
    results.push({ ...d, old: oldRes, new: newRes });
  }

  const html = htmlReport(results, outDir);
  const htmlPath = join(outDir, 'report.html');
  await writeFile(htmlPath, html, 'utf8');
  await writeFile(join(outDir, 'raw.json'), JSON.stringify(results, null, 2), 'utf8');

  console.log(`\n결과: ${htmlPath}`);
  console.log(`raw : ${join(outDir, 'raw.json')}`);
  console.log(`\n다음: open ${htmlPath} → 본인 채점`);
}

main().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(1);
});
