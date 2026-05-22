import { FAL_KEY, FAL_API_BASE } from './config';

const STYLE_MAP: Record<string, string> = {
  watercolor: 'watercolor illustration, soft pastel colors, gentle brush strokes, emotional and nostalgic',
  fairytale: 'storybook illustration, warm magical atmosphere, whimsical and dreamy, rich gentle colors',
  sketch: 'soft pencil sketch style, light and airy, minimalist with warm undertones',
  vibrant: 'vibrant digital painting, warm sunlight, expressive rich colors, energetic yet soft',
  night: 'night scene with soft moonlight, deep blues and warm yellows, calm and peaceful',
};

const SCENES = [
  'a winding path through a peaceful park',
  'a cozy cafe with large windows',
  'a quiet street with autumn trees',
  'a bench overlooking a calm pond',
  'a garden with blooming flowers',
  'a rooftop with fairy lights at dusk',
  'a library corner with warm lamp light',
  'a riverside walking trail',
  'a city street in soft morning light',
  'a quiet beach at sunset',
  'a traditional hanok courtyard in spring',
  'a hillside overlooking the city at night',
];

function extractMood(text: string): string {
  const lower = text.toLowerCase();
  if (/기쁜|행복|즐거|웃음|좋았|감사|고마운|开心|幸福/.test(lower)) return 'happy';
  if (/슬프|눈물|우울|외롭|그리움|힘들|지쳤|伤心|累/.test(lower)) return 'sad';
  if (/평화|조용|여유|편안|차분|고요|安静|舒服/.test(lower)) return 'calm';
  if (/신나|재밌|떨리|설렘|두근|기대|兴奋|开心/.test(lower)) return 'excited';
  if (/피곤|졸리|지친|늦은|疲劳/.test(lower)) return 'tired';
  if (/화나|짜증|속상|답답|生气|烦躁/.test(lower)) return 'angry';
  return 'peaceful';
}

function getRandomScene(): string {
  return SCENES[Math.floor(Math.random() * SCENES.length)];
}

function buildPrompt(content: string, style: string): string {
  const maxContent = content.slice(0, 250);
  const styleDesc = STYLE_MAP[style] || STYLE_MAP.watercolor;
  const scene = getRandomScene();
  const mood = extractMood(content);
  const seed = Math.floor(Math.random() * 1000000);

  return `${styleDesc}, ${scene}. Diary entry mood: ${mood}. Based on this personal diary: "${maxContent}". Korean setting, emotional, artistic, beautiful lighting. seed:${seed}`;
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
