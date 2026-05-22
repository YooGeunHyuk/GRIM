# GRIM (그림) — AI 그림일기 앱

하루를 기록하면 AI가 그림으로 그려주는 감성 일기 앱.

> "비 온 뒤 맑게 갠 하늘, 커피 한 잔, 회사 강아지와의 산책 — 마음속 답답함이 내려가는 기분"
> ✍️ 일기를 쓰면 → 🎨 AI가 수채화/지브리/펜드로잉/일러스트로 그림

---

## 🖼️ 핵심 기능

- **일기 쓰기** — 오늘의 이야기를 자유롭게 기록
- **AI 그림 생성** — 일기 내용을 분석해 4가지 스타일로 그림 생성
- **스타일 선택** — 수채화 / 동화(지브리) / 스케치(펜드로잉) / 채색(일러스트)
- **달력 보기** — 날짜별로 모아보기
- **다시 그리기** — 마음에 안 들면 새로운 그림으로

## 🎨 그림 스타일

| 스타일 | 설명 | 기법 |
|--------|------|------|
| 수채화 | 투명한 수채화 물감 레이어, 종이 질감, 번짐 효과 | 전통 수채화 기법 |
| 동화 | 지브리/미야자키 스타일, 부드러운 파스텔 톤 | 셀 애니메이션 |
| 스케치 | 흑백 로트링 펜 드로잉, 크로스해칭 | 펜화 |
| 채색 | 붓질이 보이는 디지털 페인팅 | 컨셉 아트 |

## 🧠 그림 생성 방식

1. 일기 내용(한글)을 분석해 **날씨, 장소, 시간, 사물, 감정**을 추출
2. 추출된 요소를 **영어 장면 설명**으로 변환 (Flux Schnell이 한글을 잘 못 읽음)
3. 선택한 스타일의 상세 기법 설명과 합쳐서 프롬프트 구성
4. FAL Flux Schnell API 호출 → 1~2초 내 그림 생성

## 🛠️ 기술 스택

| 항목 | 사용 |
|------|------|
| 프레임워크 | Expo (React Native) |
| 이미지 생성 | FAL.ai Flux Schnell |
| 저장소 | AsyncStorage (로컬) |
| 버전 관리 | GitHub (public) |
| AI 코딩 | Claude Code |

## 📁 프로젝트 구조

```
grim/
├── App.tsx                 # 앱 진입점
├── src/
│   ├── screens/
│   │   ├── WriteScreen.tsx  # 일기 쓰기 + 그림 생성 화면
│   │   ├── CalendarScreen.tsx # 달력 모아보기
│   │   └── DetailScreen.tsx  # 상세 보기
│   ├── lib/
│   │   ├── imageGen.ts      # FAL Flux Schnell 프롬프트 생성 + API 호출
│   │   ├── storage.ts       # AsyncStorage CRUD
│   │   └── config.ts        # 🔒 API 키 (gitignore)
│   └── types.ts             # DiaryEntry 타입
└── .env.example             # 환경 변수 템플릿
```

## 🚀 실행

```bash
# config.ts 생성 (필수!)
echo "export const FAL_KEY = 'YOUR_FAL_KEY';" > src/lib/config.ts
echo "export const FAL_API_BASE = 'https://fal.run/fal-ai';" >> src/lib/config.ts

# 실행
npx expo start
```

## 📸 미리보기

*(앱 캡처 준비 중)*

---

*GRIM — 매일을 그림으로 남기다.*
