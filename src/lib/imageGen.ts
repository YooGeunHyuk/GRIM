const STYLE_MAP: Record<string, string> = {
  watercolor: 'Watercolor illustration, gentle and emotional. Soft pastel colors, delicate brush strokes, dreamy atmosphere.',
  fairytale: 'Children\'s storybook illustration. Warm, magical, whimsical. Rich colors, gentle fantasy atmosphere.',
  sketch: 'Soft pencil sketch style. Light, airy, minimalist. Monochrome with subtle warm tones.',
  vibrant: 'Vibrant digital painting with warm sunlight. Expressive colors, rich textures, energetic but soft.',
  night: 'Night scene with soft moonlight. Deep blues and warm yellows, twinkling stars, calm and peaceful atmosphere.',
};

const MOOD_COLORS: Record<string, string> = {
  happy: 'Warm golden sunlight, bright cheerful colors, vibrant and uplifting atmosphere.',
  sad: 'Soft muted tones, gentle blue-grey palette, quiet melancholic but beautiful atmosphere.',
  calm: 'Pale lavender and soft sage green tones, tranquil and peaceful, like a quiet afternoon.',
  excited: 'Vibrant warm colors, golden hour light, energetic and lively composition.',
  tired: 'Low saturation warm tones, cozy dim light, soft comfortable atmosphere like a quiet evening.',
  angry: 'Stormy shades of deep blue and grey with warm orange accents, dramatic sky, intense atmosphere.',
};

const SCENE_ELEMENTS = [
  'a winding path through a park',
  'a cozy cafe interior with large windows',
  'a quiet street lined with autumn trees',
  'a bench overlooking a peaceful pond',
  'a small garden with blooming flowers',
  'a rooftop with fairy lights at dusk',
  'a library corner with warm lamp light',
  'a riverside walking trail',
  'a city street in the soft morning light',
  'a mountain trail with distant views',
  'a quiet beach at sunset',
  'a traditional hanok courtyard',
];

const WEATHER_EFFECTS: Record<string, string> = {
  sunny: 'Bright clear day, warm sunlight filtering through trees, long soft shadows.',
  cloudy: 'Soft diffused light through clouds, gentle muted colors, calm overcast atmosphere.',
  rainy: 'Gentle rain, wet streets reflecting light, fresh green colors, cozy atmospheric mood.',
  snowy: 'Soft snowfall, white blanket covering everything, warm lights from windows, quiet stillness.',
  windy: 'Leaves swirling in the breeze, dynamic sky with moving clouds, fresh energy in the air.',
  foggy: 'Soft mist floating through the air, mysterious layers, everything softly blurred and dreamy.',
};

function getSeed(): number {
  return Math.floor(Math.random() * 1000000);
}

function extractKeywords(text: string): { mood?: string; weather?: string } {
  const lower = text.toLowerCase();
  
  const moodMap: [RegExp, string][] = [
    [/기쁜|행복|즐거|신나|웃음|좋았|감사|고마운/, 'happy'],
    [/슬프|눈물|우울|외롭|그리움|보고싶|힘들|지쳤/, 'sad'],
    [/평화|조용|여유|편안|차분|고요|느긋/, 'calm'],
    [/신나|재밌|떨리|설렘|두근|기대|새로운/, 'excited'],
    [/피곤|졸리|지친|늦은|힘들|에너지/, 'tired'],
    [/화나|짜증|열받|속상|답답|스트레스/, 'angry'],
  ];
  
  const weatherMap: [RegExp, string][] = [
    [/맑|햇빛|햇살|화창|쨍/, 'sunny'],
    [/흐리|구름|먹구름/, 'cloudy'],
    [/비|빗방울|소나기|장마|촉촉/, 'rainy'],
    [/눈|폭설|함박|쌓인/, 'snowy'],
    [/바람|바람|강풍/, 'windy'],
    [/안개|뿌연|스모그|뿌옇/, 'foggy'],
  ];

  let mood: string | undefined;
  let weather: string | undefined;

  for (const [pattern, result] of moodMap) {
    if (pattern.test(lower)) { mood = result; break; }
  }
  for (const [pattern, result] of weatherMap) {
    if (pattern.test(lower)) { weather = result; break; }
  }

  return { mood, weather };
}

function getRandomScene(): string {
  return SCENE_ELEMENTS[Math.floor(Math.random() * SCENE_ELEMENTS.length)];
}

function buildPrompt(diaryContent: string, style: string = 'watercolor'): string {
  const maxContent = diaryContent.slice(0, 300);
  const styleDesc = STYLE_MAP[style] || STYLE_MAP.watercolor;
  const { mood, weather } = extractKeywords(diaryContent);
  
  const moodColor = mood ? MOOD_COLORS[mood] : 'Warm, gentle colors matching the emotional tone of the diary.';
  const weatherEffect = weather ? WEATHER_EFFECTS[weather] : 'Soft natural light, peaceful atmosphere.';
  const scene = getRandomScene();
  const seed = getSeed();

  return `${styleDesc} A scene of ${scene}. ${moodColor} ${weatherEffect} Based on this diary: "${maxContent}" Korean setting, emotional, personal, artistic. style-seed:${seed}`;
}

export function generateImageUrl(
  diaryContent: string,
  style: string = 'watercolor'
): string | null {
  if (!diaryContent.trim()) return null;
  const prompt = buildPrompt(diaryContent, style);
  const encoded = encodeURIComponent(prompt);
  // Add the seed as a query param to force cache-bust
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${getSeed()}&t=${Date.now()}`;
}

export function getAvailableStyles(): string[] {
  return Object.keys(STYLE_MAP);
}
