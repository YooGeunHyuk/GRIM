// 백엔드 프록시로 일기 → 정교한 그림 생성 + 로컬 영구 저장.
//
// V1 (2026-05-23): 정규식 + FAL 직접 호출 → 프록시 한 줄 fetch 교체.
// V2 (2026-05-23): FAL URL 만료 대응. 받는 즉시 documentDirectory에 원본+썸네일 다운로드.
//   - 원본: 상세화면용
//   - 썸네일 80×60: 달력 격자용 (메모리 30MB→2MB)
//
// 라이브러리: expo-file-system 새 API(File/Directory/Paths, SDK 54+),
//           expo-image-manipulator 새 API(manipulate().renderAsync().saveAsync()).
//           키는 프록시 env에. 앱엔 0개.

import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const PROXY_URL = 'https://grim-proxy.vercel.app/api/generate';
const TIMEOUT_MS = 45_000; // LLM ~2s + Flux 2 Pro ~10s + 여유
const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 60;

const dir = new Directory(Paths.document, 'grim');

export type Style = 'watercolor' | 'cartoon' | 'pendrawing' | 'crayon';

const STYLE_LABELS: Record<Style, string> = {
  watercolor: '수채화',
  cartoon: '카툰',
  pendrawing: '펜드로잉',
  crayon: '크레용',
};

export function getAvailableStyles(): Style[] {
  return ['watercolor', 'cartoon', 'pendrawing', 'crayon'];
}

export function getStyleLabel(style: Style): string {
  return STYLE_LABELS[style];
}

export type GenerateResult = {
  imageLocalPath: string | null;
  imageThumbPath: string | null;
  imageUrl: string | null; // 원격 URL (디버깅/메타, 만료될 수 있음)
  error?: string;
};

function ensureDir() {
  if (!dir.exists) dir.create();
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function downloadAndThumb(
  remoteUrl: string
): Promise<{ localPath: string; thumbPath: string }> {
  ensureDir();
  const id = newId();

  // 1) Directory로 다운로드 (URL-파생 이름) → 우리 id 이름으로 rename
  const downloaded = await File.downloadFileAsync(remoteUrl, dir);
  const origDest = new File(dir, `${id}.jpg`);
  downloaded.move(origDest);
  // move 후 downloaded.uri는 새 경로로 업데이트됨

  // 2) 80×60 썸네일 생성 (새 chainable API: manipulate → renderAsync → saveAsync)
  const ctx = ImageManipulator.manipulate(downloaded.uri);
  ctx.resize({ width: THUMB_WIDTH, height: THUMB_HEIGHT });
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });

  // 3) cache에 저장된 썸네일을 documentDirectory로 이동
  const thumbSrc = new File(saved.uri);
  const thumbDest = new File(dir, `${id}_thumb.jpg`);
  thumbSrc.move(thumbDest);

  return { localPath: downloaded.uri, thumbPath: thumbSrc.uri };
}

export async function generateImage(
  content: string,
  style: Style = 'watercolor'
): Promise<GenerateResult> {
  const text = content.trim();
  if (text.length < 10) {
    return {
      imageLocalPath: null,
      imageThumbPath: null,
      imageUrl: null,
      error: '일기를 조금 더 적어주세요',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // 1) 프록시 호출 → 원격 이미지 URL
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diary: text, style }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return {
        imageLocalPath: null,
        imageThumbPath: null,
        imageUrl: null,
        error: data?.error || `오류 ${res.status}`,
      };
    }
    const remoteUrl: string | undefined = data?.imageUrl;
    if (!remoteUrl) {
      return {
        imageLocalPath: null,
        imageThumbPath: null,
        imageUrl: null,
        error: '이미지 주소를 받지 못했어요',
      };
    }

    // 2) 받자마자 로컬 다운로드 + 썸네일 (만료 전에)
    try {
      const { localPath, thumbPath } = await downloadAndThumb(remoteUrl);
      return {
        imageLocalPath: localPath,
        imageThumbPath: thumbPath,
        imageUrl: remoteUrl,
      };
    } catch (dlErr: any) {
      // 다운로드 실패 시 원격 URL이라도 일시 반환 (UX 살림)
      return {
        imageLocalPath: null,
        imageThumbPath: null,
        imageUrl: remoteUrl,
        error: '그림은 받았는데 저장에 실패했어요. 다시 그리기로 재시도해보세요.',
      };
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        imageLocalPath: null,
        imageThumbPath: null,
        imageUrl: null,
        error: '시간이 너무 걸려요. 다시 시도해주세요',
      };
    }
    return {
      imageLocalPath: null,
      imageThumbPath: null,
      imageUrl: null,
      error: err?.message || '네트워크 오류',
    };
  } finally {
    clearTimeout(timer);
  }
}
