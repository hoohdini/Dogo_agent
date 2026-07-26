# MADI Desktop 🐾

Windows XP 검색 도우미(강아지) 스타일의 **데스크톱 AI 마스코트 도우미**.
평소엔 숨어 있다가 부르면 픽셀 강아지가 화면 우하단으로 달려와 도움을 제공합니다.

## 실행

```bash
npm install
npm run dev        # Electron 앱 실행 (메뉴바 상주)
```

- **⌥ + Space** — MADI 부르기 / 숨기기 (전역 단축키)
- **메뉴바 발바닥 아이콘** — 부르기/숨기기, 종료
- **Esc / 말풍선 ✕** — 숨기기
- 강아지를 드래그하면 위치를 옮길 수 있어요

```bash
npm run dev:web    # 브라우저에서 UI만 빠르게 확인 (데모 모드, :5199)
npm run build      # 프로덕션 빌드 (out/)
npm run typecheck
```

## 구조

```
electron/
  main.ts      # 창 관리(투명·항상 위·우하단), 트레이, 전역 단축키
  preload.ts   # window.madi API (hide, onShown)
  icon.ts      # 트레이 발바닥 아이콘 PNG를 코드로 생성
src/
  App.tsx                  # 상태 흐름: 등장 → 인사 → 메뉴 → 응답
  components/Mascot.tsx    # 픽셀 강아지 — 캔버스에 직접 그림 (idle/run/think/talk)
  components/SpeechBubble.tsx
  styles.css               # XP 스타일 말풍선·선택지
```

## 로드맵

- [x] **Phase 1** — 위젯 셸 + 픽셀 강아지 + 말풍선 UI
- [ ] **Phase 2** — 국내 LLM 5종 연동 (Upstage Solar Pro 2 · SKT A.X-K1 · LG K-EXAONE · KT 믿:음 2.0 · NC VARCO), 스트리밍 채팅
- [ ] **Phase 3** — 선택 텍스트 캡처(⌥+Space로 드래그한 텍스트 들고 등장), 코드/글 컨텍스트 감지
- [ ] **Phase 4** — 우클릭 "MADI 부르기"(macOS 서비스), 히스토리, 설정, 자료조사
