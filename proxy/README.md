# GRIM 프록시

앱과 fal.ai 사이의 얇은 중개 서버. **키를 숨긴 채** Flux 2 Pro를 호출한다.
앱에는 어떤 API 키도 들어가지 않는다.

엔드포인트: `POST /api/generate`
- 요청: `{ "diary": "오늘 일기...", "style": "watercolor|cartoon|pendrawing", "scene"?: "영어 장면(선택)" }`
- 응답: `{ "imageUrl": "https://..." }`

> 현재 = T2(인프라). 일기→LLM 장면 해석은 T3에서 추가. 지금은 `scene`이 오면 그걸,
> 없으면 `diary`를 그대로 장면 힌트로 사용(한글이라 품질 낮음 — T3가 해결).

## 로컬 실행
```bash
cd proxy
npm install
cp .env.example .env.local        # .env.local 에 새 FAL_KEY 넣기
npx vercel dev                    # http://localhost:3000
```
테스트:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"diary":"비 온 뒤 맑게 갠 하늘, 커피 한 잔, 강아지와 산책","style":"watercolor"}'
```

## 배포 (Vercel)
1. https://vercel.com 가입 (무료) → `npm i -g vercel` → `vercel login`
2. `cd proxy && vercel` — 새 프로젝트 생성. **Root Directory = proxy** 로 잡힘.
3. Vercel 대시보드 → Settings → Environment Variables 에 `FAL_KEY` 등록 (코드엔 절대 X).
4. `vercel deploy --prod` → 배포 URL 확인 (예: `https://grim-proxy.vercel.app/api/generate`).
5. 앱은 이 URL만 알면 됨. (키는 모름.)

## 보안 메모
- 키는 env에만. 코드/깃 금지.
- 일기 본문은 로그에 남기지 않음 (no-retention).
- 배포 후 `ALLOWED_ORIGIN` 을 앱 도메인으로 제한.
