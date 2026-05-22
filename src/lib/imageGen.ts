import { FAL_KEY, FAL_API_BASE } from './config';

const STYLE_MAP: Record<string, string> = {
  watercolor: 'watercolor illustration, soft pastel colors, gentle brush strokes, emotional and nostalgic',
  fairytale: 'storybook illustration, warm magical atmosphere, whimsical and dreamy, rich gentle colors',
  sketch: 'soft pencil sketch style, light and airy, minimalist with warm undertones',
  vibrant: 'vibrant digital painting, warm sunlight, expressive rich colors, energetic yet soft',
  night: 'night scene with soft moonlight, deep blues and warm yellows, calm and peaceful',
};

function extractMood(text: string): string {
  const lower = text.toLowerCase();
  if (/기쁜|행복|즐거|웃음|좋았|감사|고마운|开心|幸福/.test(lower)) return 'happy';
  if (/슬프|눈물|우울|외롭|그리움|힘들|지쳤|伤心|累/.test(lower)) return 'sad';
  if (/평화|조용|여유|편안|차분|고요|내려가|개인|맑|安静|舒服/.test(lower)) return 'calm';
  if (/신나|재밌|떨리|설렘|두근|기대|兴奋|开心/.test(lower)) return 'excited';
  if (/피곤|졸리|지친|늦은|疲劳/.test(lower)) return 'tired';
  if (/화나|짜증|속상|生气|烦躁/.test(lower)) return 'angry';
  return 'peaceful';
}

function extractSetting(text: string): string {
  const lower = text.toLowerCase();
  if (/비|눈|안개|구름|흐림/.test(lower)) {
    if (/개[인ㅣ]|맑|갬/.test(lower)) return 'after rain, sky clearing up, fresh air, wet pavement reflecting light';
    return 'rainy, raindrops, overcast sky, moody atmosphere';
  }
  if (/산|등산|자연|숲|공원/.test(lower)) return 'nature, trees, fresh air, peaceful outdoor setting';
  if (/바다|바닷가|파도|해변|해변가/.test(lower)) return 'ocean, waves, seaside, sandy beach';
  if (/밤|야경|야간|어둠/.test(lower)) return 'night, city lights, stars, moonlit atmosphere';
  if (/아침|해돋|일출|모닝/.test(lower)) return 'early morning, sunrise, soft golden light';
  if (/저녁|석양|일몰|황혼/.test(lower)) return 'evening, sunset, warm orange glow';
  if (/카페|커피/.test(lower)) return 'cozy cafe, coffee cup, warm interior, relaxed atmosphere';
  if (/회사|사무실|직장|오피스/.test(lower)) return 'office, work desk, urban professional setting';
  if (/강아지|개|멍멍|댕댕/.test(lower)) return 'cute dog companion, pet walking, happy puppy';
  if (/도심|도시|시내|길|거리|서울/.test(lower)) return 'city street, urban landscape, buildings, pedestrian walkway';
  return 'everyday life scene, personal moment';
}

function buildPrompt(content: string, style: string): string {
  const maxContent = content.slice(0, 200);
  const styleDesc = STYLE_MAP[style] || STYLE_MAP.watercolor;
  const mood = extractMood(content);
  const setting = extractSetting(content);

  return `${styleDesc}, ${setting}. Mood: ${mood}. Create an illustration directly inspired by this personal diary entry: "${maxContent}". Beautiful lighting, emotional atmosphere, cinematic composition, Korean urban setting, highly detailed. --ar 4:3`;
}

export async function generateImage(
  content: string,
  style: string = 'watercolor'
): Promise<{ imageUrl: string | null; error?: string }> {
  if (!content.trim()) return { imageUrl: null, error: '내용을 입력해주세요' };

  const prompt = buildPrompt(content, style);

  try {
    const response = await fetch(`${FAL_API_BASE}/flux/schnell`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'landscape_4_3',
        num_images: 1,
        enable_safety_checker: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { imageUrl: null, error: `API 오류: ${response.status}` };
    }

    const result = await response.json();
    const imageUrl = result.images?.[0]?.url || result.image?.url || null;

    if (!imageUrl) {
      return { imageUrl: null, error: '이미지 URL을 받지 못했습니다' };
    }

    return { imageUrl };
  } catch (err: any) {
    return { imageUrl: null, error: err.message || '네트워크 오류' };
  }
}

export function getAvailableStyles(): string[] {
  return Object.keys(STYLE_MAP);
}
