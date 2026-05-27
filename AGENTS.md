# Expo HAS CHANGED

Project on Expo SDK 54 (App Store Expo Go 호환 한계).
Read exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing code.

핵심 변경점 (SDK 54):
- `expo-file-system` v19: 새 API (File / Directory / Paths 클래스). 레거시 `*Async` 함수는 deprecated, SDK 55에서 제거 예정. `File.downloadFileAsync(url, dir)` → File 반환, `.move()` 후 `.uri` 업데이트됨.
- `expo-image-manipulator` v14: 체이너블 API. `ImageManipulator.manipulate(uri).resize(...).renderAsync().then(ref => ref.saveAsync({...}))`. 구 `manipulateAsync` deprecated.
- React 19.1 / RN 0.81.5 / @react-navigation 7.x.

라이브러리 API 의심 시 context7 MCP로 최신 문서 조회 (`mcp__context7__query-docs`).
