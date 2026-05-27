// GRIM 이미지 생성 프록시 — Vercel 서버리스 함수
//
// 역할: 앱에서 일기+스타일을 받아, 키를 숨긴 채
//   1) fal any-llm 으로 일기를 영어 장면 JSON 으로 해석하고
//   2) 그 장면 + 스타일 기법으로 flux-2-pro 그림을 생성해
//   이미지 URL 을 돌려준다. 클라이언트에는 어떤 키도 노출되지 않는다.
//
//   [앱] POST /api/generate { diary, style, scene? }
//        │  (키 없음)
//        ▼
//   [이 함수]  env: FAL_KEY (LLM·이미지 둘 다 이 키 하나)
//        │  1) diary → any-llm → scene JSON (뒷모습·장면중심 페르소나 기본 적용)
//        │  2) scene + STYLE → flux-2-pro
//        │  3) 일기 본문은 로그/저장 안 함 (no-retention)
//        ▼
//   [앱] { imageUrl }  ← 받아서 로컬 파일로 다운로드(T4)
//
// 로컬 검증: proxy/test-full.mjs 로 end-to-end 확인됨 (2026-05-23).

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FAL_KEY = process.env.FAL_KEY || '';
const IMG_MODEL = process.env.FAL_MODEL || 'fal-ai/flux-2-pro';
const REDUX_MODEL = process.env.REDUX_MODEL || 'fal-ai/flux-pro/v1.1-ultra/redux';
const KID_REF_URL = process.env.KID_REF_URL || '';
const KID_REF_STRENGTH = Number(process.env.KID_REF_STRENGTH || '0.65');
const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-pro-1.5';
const FAL_BASE = 'https://fal.run';

const LLM_TIMEOUT_MS = 20_000;
const IMG_TIMEOUT_MS = 30_000;

const STYLE_MAP: Record<string, string> = {
  watercolor:
    'Lyrical traditional watercolor painting on cold-pressed cotton paper. Painterly, atmospheric, emotionally warm. Built in transparent pigment washes: pale wet-on-wet atmospheric underwash for sky and ambient light, mid-tone glazes for shapes, a few darker accent strokes for depth. Soft feathered edges with gentle color bleeds, visible paper grain, granulation in pigment, occasional bloom where wet pigment meets damp paper. Luminous semi-transparent layers with paper-white showing through. Rich detail in environment (foliage, architecture, sky, light), not minimal. Warm sun-warmed palette of ochre, soft coral, dusty rose, sage, slate blue. Hand-painted brush strokes visible. Looks like a physical watercolor in a sketchbook, full of atmosphere and feeling. Avoid: hard digital edges, vector flatness, airbrush blur, oversaturation, neon colors, photorealism, empty backgrounds, sparse minimal scenes.',
  cartoon:
    'Flat color cartoon illustration with bold confident black ink outlines. Cel-shaded animation style, clean solid color fills, no painterly texture, no watercolor wash, no blending. Densely detailed everyday environments rendered with fine ink linework around every shape. Muted but slightly saturated natural palette. Generous use of white paper as negative space. Calm nostalgic mood. Graphic illustration like a printed storybook or modern animated short. Avoid: watercolor, paint splatter, soft edges, airbrush, photorealism, gradient washes.',
  pendrawing:
    'Black ink pen drawing on white paper, urban sketch style. Fine confident linework with cross-hatching and parallel hatching for shadow. Monochrome black and white, no color. Loose but detailed, hand-drawn with character. Generous white paper as light and negative space, subject softly fading at the edges. Visible paper grain. Warm cozy observational mood. No shading wash, no gradient.',
  // crayon은 Redux(이미지 레퍼런스 기반)로 처리됨 — 아래 STYLE_MAP에는 폴백 텍스트만 둠
  crayon:
    "Korean elementary school child's marker and watercolor drawing — lines drawn SLOWLY and CAREFULLY by a concentrating kid, wobbly and jagged because of tiny unsteady fingers, NOT because of fast gestural strokes. Each line looks paused and deliberate but uneven, no smooth flowing motion. Avoid: sketchy, gestural, dynamic strokes, quick brushwork, calligraphic flow.",
};
const NEGATIVE = 'no text, no signage text, no letters, no watermark, no signature';
const DEFAULT_STYLE = 'watercolor';

type Scene = {
  scene?: string;
  chosen_moment?: string; // LLM이 어떤 문장을 핵심으로 골랐는지 (디버깅·A/B용)
  mood?: string;
  time?: string;
  weather?: string;
  location?: string;
  subjects?: string[];
  objects?: string[];
  palette?: string;
  composition?: string;
};

const LLM_SYSTEM = `You convert a Korean diary entry into a concise English visual scene for an illustration. The scene must capture the FEELING of the diary as one image.

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

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

// 일기 → 장면 JSON. 실패(네트워크/파싱) 시 throw → 호출부에서 폴백.
async function interpretDiary(diary: string): Promise<Scene> {
  const { signal, done } = withTimeout(LLM_TIMEOUT_MS);
  try {
    const res = await fetch(`${FAL_BASE}/fal-ai/any-llm`, {
      method: 'POST',
      headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: LLM_MODEL, system_prompt: LLM_SYSTEM, prompt: diary }),
      signal,
    });
    if (!res.ok) throw new Error(`any-llm ${res.status}`);
    const data: any = await res.json();
    const raw: string = data?.output ?? data?.text ?? '';
    return JSON.parse(String(raw).replace(/```json|```/g, '').trim()) as Scene;
  } finally {
    done();
  }
}

function assemblePrompt(scene: Scene, style: string): string {
  const styleDesc = STYLE_MAP[style] || STYLE_MAP[DEFAULT_STYLE];
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

// Redux는 image_url이 스타일을 결정 → prompt는 짧은 내용 + 톤 힌트만
function assembleReduxPrompt(scene: Scene): string {
  const sceneOne =
    scene.scene ||
    [scene.subjects?.join(', '), scene.location, scene.time].filter(Boolean).join(', ');
  return `${sceneOne} ${STYLE_MAP.crayon}`;
}

async function generateImage(prompt: string): Promise<string> {
  const { signal, done } = withTimeout(IMG_TIMEOUT_MS);
  try {
    const res = await fetch(`${FAL_BASE}/${IMG_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_size: 'landscape_4_3',
        num_images: 1,
        output_format: 'jpeg', // JPEG는 PNG보다 작아 다운로드/저장 빠름
        enable_safety_checker: false, // 개인 일기, 오탐 회피
      }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`fal ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const url: string | undefined = data?.images?.[0]?.url || data?.image?.url;
    if (!url) throw new Error('fal: no image url');
    return url;
  } finally {
    done();
  }
}

// 어린이 그림 스타일 — Redux로 레퍼런스 이미지 톤 전이
async function generateImageRedux(prompt: string): Promise<string> {
  if (!KID_REF_URL) throw new Error('KID_REF_URL 미설정');
  const { signal, done } = withTimeout(IMG_TIMEOUT_MS);
  try {
    const res = await fetch(`${FAL_BASE}/${REDUX_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_url: KID_REF_URL,
        image_prompt_strength: KID_REF_STRENGTH,
        aspect_ratio: '4:3',
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '6',
      }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`fal-redux ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const url: string | undefined = data?.images?.[0]?.url || data?.image?.url;
    if (!url) throw new Error('fal-redux: no image url');
    return url;
  } finally {
    done();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' });
  if (!FAL_KEY) return res.status(500).json({ error: '서버 설정 오류(FAL_KEY 없음)' });

  const { diary, style, scene } = (req.body || {}) as {
    diary?: string;
    style?: string;
    scene?: string;
  };

  const text = (scene || diary || '').trim();
  if (text.length < 10) return res.status(400).json({ error: '일기를 조금 더 적어주세요' });

  // 1) 장면 해석. scene 직접 전달 시 그대로, 아니면 LLM. LLM 실패 시 일기 원문으로 degraded 폴백.
  let sceneObj: Scene;
  if (scene) {
    sceneObj = { scene };
  } else {
    try {
      sceneObj = await interpretDiary(diary as string);
    } catch (e: any) {
      console.error('LLM 해석 실패 → 폴백:', e?.message || e);
      sceneObj = { scene: diary as string, mood: 'calm, warm, emotional' };
    }
  }

  const chosenStyle = style || DEFAULT_STYLE;
  const useRedux = chosenStyle === 'crayon' && !!KID_REF_URL;
  const prompt = useRedux
    ? assembleReduxPrompt(sceneObj)
    : assemblePrompt(sceneObj, chosenStyle);
  const runImage = () => (useRedux ? generateImageRedux(prompt) : generateImage(prompt));

  // 2) 이미지 생성: 1회 + 실패 시 1회 재시도
  try {
    let imageUrl: string;
    try {
      imageUrl = await runImage();
    } catch {
      imageUrl = await runImage();
    }
    return res.status(200).json({ imageUrl });
  } catch (err: any) {
    console.error('generate 실패:', err?.message || err); // 일기 본문은 로그 안 함
    return res.status(502).json({ error: '그림 생성에 실패했어요. 다시 시도해주세요.' });
  }
}
