// 로컬 이미지 파일을 fal storage에 업로드 → URL 출력.
// 사용: node --env-file=.env.local upload-ref.mjs ~/Downloads/goose.jpg

import { fal } from '@fal-ai/client';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY) { console.error('❌ FAL_KEY 없음'); process.exit(1); }

const path = process.argv[2];
if (!path) {
  console.error('❌ 파일 경로 인자가 없음. 사용: node --env-file=.env.local upload-ref.mjs <path>');
  process.exit(1);
}

try {
  await stat(path);
} catch {
  console.error(`❌ 파일 없음: ${path}`);
  process.exit(1);
}

fal.config({ credentials: FAL_KEY });

const buf = await readFile(path);
const ext = extname(path).toLowerCase();
const mime =
  ext === '.png' ? 'image/png'
  : ext === '.webp' ? 'image/webp'
  : 'image/jpeg';
const file = new File([buf], basename(path), { type: mime });

console.log(`① 업로드 중 (${(buf.length / 1024).toFixed(1)} KB, ${mime})...`);
const url = await fal.storage.upload(file);
console.log(`\n✅ 업로드 완료:\n${url}\n`);
console.log('이 URL을 복사해 다음 단계(test-crayon-redux.mjs)에 넘겨.');
