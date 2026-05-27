// Design tokens — DESIGN.md 의 시각 시스템을 한 곳에 모은다.
// 모든 색·폰트·간격·radius·shadow 는 여기서만 정의되고
// 화면 코드는 토큰을 import 해서 쓴다. 디자인 변경은 여기 한 군데만.

import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  GowunBatang_400Regular,
  GowunBatang_700Bold,
} from '@expo-google-fonts/gowun-batang';
import {
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';

// ─────────────────────────────────────────────────────────
// COLOR — DESIGN.md "Color" 섹션 그대로.
// 다크모드는 추후. 지금은 라이트만.
// ─────────────────────────────────────────────────────────
export const COLORS = {
  background: '#FBF6EE', // 크림 — 도화지의 배경
  surface: '#FFFDF8', // 카드/패널
  text: '#3A2E25', // 본문 — 따뜻한 브라운블랙
  muted: '#9B8979', // 캡션/요일/메타
  accent: '#C97B4A', // 테라코타 — 1차 액션·인화 순간에만
  line: '#ECE2D3', // 보더
  shadow: 'rgba(120,96,70,.16)',
} as const;

// ─────────────────────────────────────────────────────────
// SPACING — 4px 그리드. comfortable density.
// ─────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ─────────────────────────────────────────────────────────
// RADIUS — 컨테이너는 둥글게, 그림(도화지)만 0.
// ─────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 8,
  md: 14,
  pill: 999,
  paper: 0, // 그림은 각진 도화지 모서리
} as const;

// ─────────────────────────────────────────────────────────
// SHADOW — 은은한 그림자.
// ─────────────────────────────────────────────────────────
export const SHADOW = {
  paper: {
    shadowColor: '#785E46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    shadowColor: '#785E46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;

// ─────────────────────────────────────────────────────────
// FONT FAMILY — Google Fonts 패키지명 그대로.
// Pretendard 는 @expo-google-fonts 에 없어 noto-sans-kr 로 대체.
// 추후 Pretendard.ttf 번들로 진짜 Pretendard 로 교체 검토.
// ─────────────────────────────────────────────────────────
export const FONT = {
  display: 'Fraunces_700Bold', // 브랜드/온보딩, 희귀
  title: 'Fraunces_600SemiBold', // 날짜 — 화면의 주인공
  body: 'GowunBatang_400Regular', // 일기 본문 — 한글 명조
  bodyBold: 'GowunBatang_700Bold',
  ui: 'NotoSansKR_500Medium', // UI 기본 (Pretendard 자리)
  uiBold: 'NotoSansKR_600SemiBold',
  uiHeavy: 'NotoSansKR_700Bold',
} as const;

// expo-font useFonts 로 넘길 map. App.tsx 가 이걸로 로드.
export const FONT_MAP = {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  GowunBatang_400Regular,
  GowunBatang_700Bold,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
};

// ─────────────────────────────────────────────────────────
// TYPE — 위계는 새 폰트가 아니라 크기·굵기·색으로만.
// DESIGN.md "Typography" 섹션 그대로 (Minor Third 1.2 스케일).
// ─────────────────────────────────────────────────────────
export const TYPE = {
  display: {
    fontFamily: FONT.display,
    fontSize: 30,
    color: COLORS.text,
  },
  title: {
    fontFamily: FONT.title,
    fontSize: 20,
    color: COLORS.text,
  },
  heading: {
    fontFamily: FONT.uiHeavy,
    fontSize: 18,
    color: COLORS.text,
  },
  body: {
    fontFamily: FONT.body,
    fontSize: 15,
    lineHeight: 26, // 15 × 1.7
    color: COLORS.text,
  },
  label: {
    fontFamily: FONT.uiBold,
    fontSize: 14,
    color: COLORS.text,
  },
  caption: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: COLORS.muted,
  },
  micro: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: COLORS.muted,
  },
} as const;

// 글자 크기 3단계 (작게/보통/크게) — 본문 한정. 추후 설정 화면에서 전환.
export const BODY_SIZE = {
  small: { fontSize: 13, lineHeight: 21.5 }, // 13 × 1.65
  medium: { fontSize: 15, lineHeight: 26 }, // 15 × 1.7 (기본)
  large: { fontSize: 17, lineHeight: 30.6 }, // 17 × 1.8
} as const;
