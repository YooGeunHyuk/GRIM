import { FAL_KEY, FAL_API_BASE } from './config';

const STYLE_MAP: Record<string, string> = {
  watercolor: `Genuine traditional watercolor painting on cold-pressed paper. Delicate transparent pigment washes layered from light to dark, with visible paper grain texture showing through thin areas. Soft feathered edges where wet colors bleed naturally. No opaque white or black outlines -- the white of the paper itself creates highlights. Highly diluted paint creates subtle graduated washes and color blooms with organic edges. The finish is matte, luminous, and semi-transparent with the tooth of watercolor paper visible. Paint spatters and brush texture present. Gentle color transitions, soft atmospheric perspective. Rendered as a physical watercolor artwork, not digital.`,
  fairytale: `Studio Ghibli animated film style by Hayao Miyazaki. Soft cel-shaded rendering with warm pastel color palettes. Rounded organic character forms with gentle facial features. Lushly detailed background environments painted with visible soft brushwork. Lighting uses warm diffuse sunlight with gentle shadows -- everything glows with a nostalgic, hand-painted quality. Soft color transitions, not hard cel shading. A gentle storybook atmosphere with meticulously detailed natural elements: billowing clouds, wind-swept grass, softly glowing light through trees. Charming, whimsical, deeply emotional animation style. Korean countryside and city settings.`,
  sketch: `Pure black technical pen ink on bright white paper. NO COLOR whatsoever -- monochrome black and white only. Rendered entirely in high-contrast black line art using a fine Rotring technical pen (0.1mm to 0.5mm nibs). Extensive crosshatching and stippling for value and depth. Precise, deliberate strokes that define form through contour lines and directional hatching. No fill, no solid black areas, no shading. Highlights created purely by leaving the white paper blank. No smudging, no wash, no digital gradient. Visible paper tooth texture. Clean, meticulous architectural illustration style linework. Hand-drawn, not digital.`,
  vibrant: `Painted digital illustration in a stylized concept art aesthetic. Visible textured brush strokes across the entire image -- no photorealism, no photography, no smooth airbrushing, no photographic skin texture. Bold, stylized color palettes with painterly blending. Strokes of opaque paint-like color follow the form and overlap each other, creating an artistic hand-crafted look. High-end game concept art or illustrated storybook style. Matte and painterly finish with purposeful brush texture in both shadows and highlights. Expressive, artistic, clearly a painting not a photograph. Rendered illustration style, not realistic.`,
};

/** Extract main mood from Korean diary text */
function extractMood(text: string): string {
  const lower = text.toLowerCase();
  if (/기쁜|행복|즐거|웃음|좋았|감사|고마운/.test(lower)) return 'happy, joyful';
  if (/슬프|눈물|우울|외롭|그리움|힘들|지쳤/.test(lower)) return 'sad, melancholic';
  if (/평화|조용|여유|편안|차분|고요|내려가|개인|맑/.test(lower)) return 'calm, peaceful';
  if (/신나|재밌|떨리|설렘|두근|기대/.test(lower)) return 'excited, thrilled';
  if (/피곤|졸리|지친|늦은/.test(lower)) return 'tired, weary';
  if (/화나|짜증|속상/.test(lower)) return 'angry, frustrated';
  return 'peaceful, warm';
}

/** Extract main subject / person reference */
function extractSubject(text: string): string {
  const lower = text.toLowerCase();
  if (/우리|함께|같이|친구|가족/.test(lower)) return 'people together, friends,';
  if (/나|내|혼자/.test(lower)) return 'a person, alone,';
  if (/엄마|어머니/.test(lower)) return 'a mother,';
  if (/아빠|아버지/.test(lower)) return 'a father,';
  if (/연인|남친|여친|애인/.test(lower)) return 'a couple in love,';
  return 'a person,';
}

/** Extract weather/atmosphere from Korean text */
function extractWeather(text: string): string {
  const lower = text.toLowerCase();
  if (/비/.test(lower)) {
    if (/개[인ㅣ]|맑|갬/.test(lower)) return 'after rain, sky clearing up, sunlight breaking through clouds, fresh air, wet pavement reflecting golden light';
    if (/그치|멎/.test(lower)) return 'rain stopping, clouds parting, mist rising';
    return 'rainy, raindrops, overcast sky, moody atmosphere';
  }
  if (/눈/.test(lower)) return 'snowing, white snow covering everything, winter landscape, quiet and serene';
  if (/맑|화창|쨍/.test(lower)) return 'clear sunny day, bright blue sky, warm sunlight';
  if (/흐리|구름/.test(lower)) return 'cloudy, soft diffused light, overcast';
  if (/안개/.test(lower)) return 'foggy, misty, atmospheric haze';
  if (/바람/.test(lower)) return 'windy, leaves blowing, breezy atmosphere';
  if (/더[웍]|무덥/.test(lower)) return 'hot summer day, heat haze, bright intense sunlight';
  if (/추[웍]|춥/.test(lower)) return 'cold winter day, frosty air, people bundled up';
  return 'pleasant weather, soft natural light';
}

/** Extract time of day */
function extractTime(text: string): string {
  const lower = text.toLowerCase();
  if (/밤|야경|야간|어둠|저녁/.test(lower)) return 'at night, city lights, stars, moonlit';
  if (/아침|해돋|일출|모닝|새벽/.test(lower)) return 'early morning, sunrise, golden dawn light';
  if (/석양|일몰|황혼|노을/.test(lower)) return 'sunset, golden hour, warm orange twilight';
  if (/낮|오후|점심/.test(lower)) return 'afternoon, bright daylight';
  return 'soft daylight';
}

/** Extract location/setting from Korean text */
function extractLocation(text: string): string {
  const lower = text.toLowerCase();
  if (/도심|도시|시내|길|거리|서울/.test(lower)) return 'on a city street, Korean urban landscape, surrounded by buildings';
  if (/산|등산|자연|숲|공원/.test(lower)) return 'in a Korean park, surrounded by nature and trees, peaceful greenery';
  if (/바다|바닷가|파도|해변|해변가/.test(lower)) return 'at the Korean beach, ocean waves, sandy shore';
  if (/카페/.test(lower)) return 'inside a cozy Korean cafe, warm interior, window view';
  if (/회사|사무실|직장|오피스/.test(lower)) return 'at the office, Korean workplace, desk and workspace';
  if (/학교/.test(lower)) return 'at school, Korean campus, classroom';
  if (/집|방|자택/.test(lower)) return 'at home, cozy Korean room, personal space';
  if (/호수|강|계곡/.test(lower)) return 'by the lake, riverside, calm water, Korean nature';
  if (/시장|마트/.test(lower)) return 'at a Korean market, bustling with people and goods';
  return 'outdoors in a Korean town';
}

/** Extract objects/items/scene details from Korean text */
function extractDetails(text: string): string {
  const lower = text.toLowerCase();
  const details: string[] = [];

  if (/강아지|개|멍멍|댕댕|반려견/.test(lower)) details.push('a cute dog companion, a small pet dog');
  if (/고양이|냥이|고냥이/.test(lower)) details.push('a cat, a feline friend');
  if (/커피|아메리카노|라떼/.test(lower)) details.push('holding a warm cup of coffee');
  if (/차|tea/.test(lower)) details.push('a warm cup of tea');
  if (/책/.test(lower)) details.push('holding a book, reading');
  if (/음악|노래|뮤직/.test(lower)) details.push('listening to music with earphones');
  if (/꽃/.test(lower)) details.push('beautiful flowers blooming');
  if (/자전거/.test(lower)) details.push('riding a bicycle');
  if (/버스/.test(lower)) details.push('riding on a city bus, looking out the window');
  if (/지하철|전철|메트로/.test(lower)) details.push('on the subway train');
  if (/택시/.test(lower)) details.push('inside a taxi cab');
  if (/우산/.test(lower)) details.push('holding an umbrella');
  if (/운동|런닝|달리기|조깅/.test(lower)) details.push('jogging, exercising, active movement');
  if (/산책|걷|걸었/.test(lower)) details.push('taking a peaceful walk, strolling');
  if (/맛있|음식|밥|요리|먹/.test(lower)) details.push('enjoying delicious food, a meal');
  if (/술|맥주|소주|와인/.test(lower)) details.push('having a drink, a glass of soju');
  if (/친구/.test(lower)) details.push('with a close friend');
  if (/가족/.test(lower)) details.push('with family members');
  if (/연인|남친|여친|데이트/.test(lower)) details.push('on a romantic date');
  if (/창문|window/.test(lower)) details.push('looking out a window');
  if (/햇빛|햇살|태양/.test(lower)) details.push('warm sunlight streaming through');

  return details.length > 0 ? details.join(', ') : 'everyday life scene';
}

/**
 * Build a prompt that creates a scene matching the diary content.
 * The scene (English) comes FIRST, then the detailed style description.
 */
function buildPrompt(content: string, style: string): string {
  const styleDesc = STYLE_MAP[style] || STYLE_MAP.watercolor;

  const subject = extractSubject(content);
  const weather = extractWeather(content);
  const time = extractTime(content);
  const location = extractLocation(content);
  const details = extractDetails(content);
  const mood = extractMood(content);

  // Scene comes first — concrete, visual, in English
  const sceneParts = [subject, location, time, weather, details].filter(Boolean);
  const sceneDescription = sceneParts.join(' ');

  // Full prompt: scene (front!) + style + mood + composition
  return `${sceneDescription}. ${styleDesc} Mood: ${mood}. Cinematic composition, beautiful natural lighting, emotional storytelling atmosphere, Korean setting, highly detailed masterpiece. Diary context: "${content.slice(0, 120)}"`;
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
