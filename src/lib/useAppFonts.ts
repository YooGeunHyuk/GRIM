// 앱 시작 시 한 번만 모든 폰트를 비동기 로드.
// 로드 완료 전엔 App 이 null 을 반환해 split-second flash 를 막는다.

import { useFonts } from 'expo-font';
import { FONT_MAP } from './theme';

export function useAppFonts(): boolean {
  const [loaded] = useFonts(FONT_MAP);
  return loaded;
}
