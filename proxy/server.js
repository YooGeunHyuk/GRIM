const http = require('http');
const https = require('https');

const FAL_KEY = '623d6f0b-4b75-43a3-b492-9a72f277cf01:dc2e35daf5d918469dd726fd72922cb3';
const PORT = 3456;

function falRequest(model, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'fal.run',
      path: `/fal-ai/${model}`,
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve({ error: 'Parse failed', raw: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseDiaryForPrompt(content) {
  const maxContent = content.slice(0, 300);
  const sceneElements = [
    'a winding path through a peaceful park',
    'a cozy cafe with large windows',
    'a quiet street lined with autumn trees',
    'a bench overlooking a calm pond',
    'a garden with blooming flowers',
    'a rooftop with fairy lights at dusk',
    'a library corner with warm lamp light',
    'a riverside walking trail',
    'a city street in soft morning light',
    'a quiet beach at sunset',
  ];
  const scene = sceneElements[Math.floor(Math.random() * sceneElements.length)];
  const seed = Math.floor(Math.random() * 1000000);

  return `Watercolor illustration, diary style. ${scene}. Soft pastel colors, emotional, nostalgic. Based on this diary: "${maxContent}" Korean atmosphere. style-seed:${seed}`;
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', async () => {
    try {
      const { content, style = 'watercolor' } = JSON.parse(body);

      if (!content || !content.trim()) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'No content' }));
        return;
      }

      const prompt = parseDiaryForPrompt(content);
      const result = await falRequest('flux/schnell', {
        prompt,
        image_size: 'landscape_4_3',
        num_images: 1,
        enable_safety_checker: false,
      });

      if (result.error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      const imageUrl = result.images?.[0]?.url || result.image?.url || null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        imageUrl,
        prompt,
        seed: Math.floor(Math.random() * 1000000),
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 GRIM Image Proxy running on http://0.0.0.0:${PORT}`);
  console.log(`   POST / with JSON { "content": "...", "style": "watercolor" }`);
});
