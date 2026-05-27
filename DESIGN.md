# Design System — GRIM (그림)

## Product Context
- **What this is:** "그림으로 기록하는 하루" — 일기를 쓰면 AI가 그날을 한 장의 그림으로 그려주는 그림일기 앱.
- **Who it's for:** 일기를 쓰고 싶지만 작심삼일인 사람. 그림이 보상이 돼 계속 쓰게 만든다.
- **Space/industry:** 일기·저널링 / 감성 기록 앱 (iOS 우선, Expo/React Native).
- **Project type:** 모바일 앱.
- **Memorable thing (북극성):** "내 하루가 그림이 됐다는 따뜻한 놀라움." 모든 디자인 결정이 이 한 문장을 위해 움직인다.

## Aesthetic Direction
- **Direction:** 따뜻한 아날로그 사진첩 (Organic × Editorial). 매 일기를 종이에 그려진 한 장의 그림처럼.
- **Decoration level:** intentional — 종이 질감(paper grain), 부드러운 그림자만. 패턴·스티커·파스텔 캐릭터 금지.
- **Mood:** 따뜻하고 정성스럽고 어른스럽게. 차가운 productivity 느낌도, 유치한 다꾸 느낌도 아니다.
- **계속 봐도 안 질리는 게 최우선:** 화려함보다 절제. 폰트 3개가 각자 한 가지 일만 한다.
- **빈틈(왜 이 방향인가):** 일기앱 카테고리는 *차가운 미니멀(Day One)* 아니면 *유치한 파스텔(다꾸·Daylio)* 둘 중 하나. "따뜻 + 정성 + 어른스러움" 자리는 비어 있다.

## 핵심 화면 레이아웃 — 옛날 그림일기 (그림 위 · 글 아래)
- 작성 상태: 헤더(날짜·요일·날씨) + 일기 쓰는 영역(화면을 채움) + 헤더 우측의 콤팩트한 "✎ 그림 그리기" 버튼.
- "✎ 그림 그리기"를 누르면 → **본문이 스르륵 아래로 내려가고, 그 위로 그림 영역이 펼쳐진다** (max-height 전환 ~0.9s). 최종 형태 = 그림 위, 글 아래 (전통 그림일기장).
- 그림은 **프레임(액자) 없음**, **각진 모서리(도화지처럼, border-radius 0)**, 종이 질감 오버레이, 은은한 그림자만.
- 그림 **제목**은 그림 **오른쪽 아래에 작은 글씨**(Caption: 요일·날씨와 같은 크기·색). LLM이 일기 내용으로 한 줄, 딱 들어갈 길이로 생성. 스타일명("수채화") 캡션은 쓰지 않는다.

## 핵심 모션 — 대기와 인화는 하나의 동작
- 글 쓴 직후 결과가 너무 빨리 나오지 않게 **뜸**을 들인다 (대기 ~2.2s). 기다림이 곧 설렘.
- **대기 = 공개의 일부:** 빈 종이("그림을 그리는 중", 은은한 호흡 애니메이션) → 흐릿한 형체 → 천천히 선명 (**인화 ~5s, 더 천천히**). 스피너 없음, 끊김 없는 한 동작.
- 마지막에 제목이 페이드인.
- 다시 그리기는 **1회 제한** — 생성 후 버튼이 "↻ 다시 그리기 (1회)"로 바뀐다.

## Typography
폰트 3개, 각자 한 가지 역할만 (안 질리는 비결). 위계는 새 폰트·장식이 아니라 크기·굵기·색으로만.
- **Display (브랜드/온보딩, 희귀):** Fraunces 600 — 30px
- **Title (날짜):** Fraunces 600 — 20px. 화면의 주인공 제목.
- **Heading (섹션):** Pretendard 700 — 18px
- **Body (일기 본문):** Gowun Batang (한글 명조) — 15px, line-height 1.7. 감정의 자리. 손글씨 일기 같은 따뜻함.
- **Label (버튼·UI):** Pretendard 600 — 14px
- **Caption (요일·날씨·그림 제목·메타):** Pretendard 500 — 12px, 색 #9B8979
- **Micro (힌트):** Pretendard 500 — 11px
- **Scale:** Minor Third (1.2) — 단계 차이가 작아 부드럽고 안 질림. 4px 그리드.
- **글자 크기 설정 3단계:** 작게(본문 13px/LH 1.65) · 보통(15px/1.7) · 크게(17px/1.8). 긴 일기 대비.
- **Loading:** Fraunces·Gowun Batang = Google Fonts. Pretendard = jsDelivr CDN (orioncactus/pretendard). RN에서는 expo-font로 로드(현재 @expo-google-fonts/noto-sans-kr 사용 중 → Gowun Batang/Pretendard로 교체 검토).

## Color
- **Approach:** restrained — 따뜻한 뉴트럴 중심, 액센트는 아껴서.
- **Background (크림):** #FBF6EE
- **Surface:** #FFFDF8
- **Text (본문):** #3A2E25 (따뜻한 브라운블랙)
- **Muted (흐린 텍스트/캡션):** #9B8979
- **Accent (테라코타):** #C97B4A — 핵심 행동과 인화되는 순간에만.
- **Line/border:** #ECE2D3
- **Shadow:** rgba(120,96,70,.16)
- **Dark mode:** 순흑 금지. bg #1F1A16, surface #2A231D, text #EFE6DA, muted #A2917F, accent #D98A57 (채도 약간↓), line #3A2F26.

## Spacing
- **Base unit:** 4px / 8px 그리드.
- **Density:** comfortable — 여백이 곧 감성. 단 본문은 줄간격 1.7로 적당히 좁혀 긴 글 부담↓.

## Layout
- **Approach:** hybrid — 쓰기 화면은 차분·집중형, 회고(달력·갤러리)는 작품이 주인공인 사진첩.
- **화면 비율:** 실제 스마트폰 비율 기준(약 390×844, 9:19.5)으로 설계.
- **Border radius:** 컨테이너·카드 sm 8 / md 14 / 알약 999. **단 그림(도화지)은 0(각진 모서리).**
- **버튼:** 콤팩트한 알약형(작은 높이), full-width 큰 버튼 지양. 1차 = 액센트 아웃라인, hover 시 채움.

## Motion
- **Approach:** intentional. 시그니처 = 대기→인화(위 "핵심 모션").
- **Easing:** enter ease-out / move cubic-bezier(.4,0,.2,1) / exit ease-in.
- **Duration:** 대기 ~2.2s, 인화 ~5s, 레이아웃 전환 ~0.9s, 제목 페이드 ~1s.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-22 | 초기 디자인 시스템 생성 | /design-consultation. 리서치(Day One/Daylio/다꾸 + 2026 warm minimalism) + GRIM 맥락 기반 |
| 2026-05-22 | 그림일기 레이아웃(그림 위/글 아래) + 펼침 전환 | 정체성·향수와 일치 |
| 2026-05-22 | 그림 프레임 제거 + 각진 도화지 모서리 + 종이질감 | 어른스럽고 안 질리게, 실제 도화지 느낌 |
| 2026-05-22 | 제목을 그림 우측 하단 Caption으로 | 그림이 주인공, 제목은 서명처럼 |
| 2026-05-22 | 명조 본문 + Fraunces 날짜 + Pretendard UI, 글자 3단계 | 감성·어른스러움 + 긴 일기 가독성 |
