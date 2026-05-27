export type Weather =
  | '맑음'
  | '구름조금'
  | '흐림'
  | '비'
  | '소나기'
  | '눈'
  | '안개';

export type Mood =
  | '기쁨'
  | '평온'
  | '설렘'
  | '그리움'
  | '무덤덤'
  | '우울'
  | '지침'
  | '화남';

export const MOODS: Mood[] = [
  '기쁨',
  '평온',
  '설렘',
  '그리움',
  '무덤덤',
  '우울',
  '지침',
  '화남',
];

export const MOOD_COLORS: Record<Mood, string> = {
  기쁨: '#F0C26B',
  평온: '#A9C9C0',
  설렘: '#F0A8B0',
  그리움: '#B8A4C9',
  무덤덤: '#D4C9B8',
  우울: '#8F8C8A',
  지침: '#A89888',
  화남: '#D87A5A',
};

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  weather?: Weather | null; // 수동 칩 선택
  mood?: Mood | null; // 수동 칩 선택
  // V2: 로컬 파일 경로가 진실의 원천 (FAL URL 만료 대응).
  imageLocalPath: string | null;
  imageThumbPath: string | null;
  // 옵션: 디버깅/재현용 메타. UI는 안 씀.
  imageUrl?: string | null; // 원격 URL (만료될 수 있음)
  imagePrompt?: string | null;
  sceneJson?: string | null; // LLM이 뽑은 장면 JSON (raw)
  style?: string | null; // 'watercolor' | 'cartoon' | 'pendrawing'
  regenerated?: boolean; // 다시 그리기 1회 사용 여부
  // V6 (CloudKit) 예정
  cloudKitRecordId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RootStackParamList = {
  Main: undefined;
  Detail: { entryId: string };
};
