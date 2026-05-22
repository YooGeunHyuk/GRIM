const STYLE_MAP: Record<string, string> = {
  watercolor: 'Watercolor illustration in a gentle picture-diary style. Soft, emotional, nostalgic pastel tones.',
  fairytale: 'Children\'s storybook illustration style. Warm, magical, dreamy atmosphere.',
  sketch: 'Pencil sketch style. Light, airy, minimalist line drawing.',
};

function buildPrompt(diaryContent: string, style: string = 'watercolor'): string {
  const maxContent = diaryContent.slice(0, 500);
  const styleDesc = STYLE_MAP[style] || STYLE_MAP.watercolor;
  return `${styleDesc} Based on this diary entry: "${maxContent}" Korean atmosphere, emotional and personal.`;
}

/**
 * Generate an image URL from diary content using Pollinations.ai (free API).
 * Returns the image URL directly.
 */
export function generateImageUrl(diaryContent: string, style: string = 'watercolor'): string | null {
  if (!diaryContent.trim()) return null;
  const prompt = buildPrompt(diaryContent, style);
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?t=${Date.now()}`;
}
