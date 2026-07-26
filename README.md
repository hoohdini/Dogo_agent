# MADI Desktop 🐾

Windows XP 검색 도우미(강아지) 스타일의 **데스크톱 AI 마스코트 도우미**.
평소엔 숨어 있다가 부르면 픽셀 강아지가 화면 우하단으로 달려와 도움을 제공합니다.

## 실행

```bash
npm install
cp .env.example .env.local   # 국내 모델 API 키 채우기
npm run dev                  # Electron 앱 실행 (메뉴바 상주)
```

- **⌥ + Space** — MADI 부르기 / 숨기기 (전역 단축키)
- **텍스트 드래그 → ⌥ + Space** — 어떤 앱에서든 선택한 텍스트를 강아지가 물고 옴
  (최초 1회 시스템 설정 → 개인정보 보호 및 보안 → **손쉬운 사용**에서 Electron/MADI 허용 필요)
- **메뉴바 발바닥 아이콘** — 부르기/숨기기, 종료
- **Esc / 말풍선 ✕** — 숨기기
- 강아지를 드래그하면 위치를 옮길 수 있어요

```bash
npm run dev:web    # 브라우저에서 UI만 빠르게 확인 (데모 모드, :5199)
npm run smoke      # LLM 연동 스모크 테스트 (npm run smoke -- all)
npm run build      # 프로덕션 빌드 (out/)
npm run typecheck
```

## 모델 라우팅

| 액션 | 기본 모델 | 비고 |
|---|---|---|
| 🔍 설명해줘 | LG K-EXAONE | 코드·개념 설명 |
| ✏️ 맞춤법 검사 | KT 믿:음 2.0 | 한국어 특화 |
| 📝 요약해줘 | SKT A.X-K1 | 팀 공유 키 RPS 3 → 직렬화 큐 |
| 🌐 번역해줘 | Upstage Solar Pro 2 | |
| 💬 그냥 채팅 | Upstage Solar Pro 2 | 기본 모델 |

채팅 패널 우측 상단에서 언제든 수동 변경 가능. VARCO는 챗 API 스펙 확보 전까지 "준비 중".

## 구조

```
electron/
  main.ts        # 창 관리(투명·항상 위·우하단), 트레이, 전역 단축키, 채팅 IPC
  preload.ts     # window.madi API (hide/onShown/chatStart/chatAbort/onChatEvent)
  selection.ts   # 선택 텍스트 캡처 (Cmd+C 시뮬레이트 + 클립보드 복원)
  icon.ts        # 트레이 발바닥 아이콘 PNG를 코드로 생성
  llm/
    env.ts       # .env.local 로더
    stream.ts    # 국내 LLM SSE 스트리밍 (재시도·SKT 직렬화·타임아웃)
shared/
  models.ts      # 모델 카탈로그 (메인·렌더러 공유)
  actions.ts     # 액션 정의 + 모델 라우팅 + 시스템 프롬프트
  ipc.ts         # 채팅 IPC 타입
src/
  App.tsx                  # 상태 흐름: 등장 → 인사 → 메뉴 → 채팅
  components/Mascot.tsx    # 픽셀 강아지 — 캔버스에 직접 그림 (idle/run/think/talk)
  components/ChatPanel.tsx # 스트리밍 채팅 패널 (모델 선택·중단·IME 대응)
  components/SpeechBubble.tsx
  styles.css               # XP 스타일 말풍선·선택지·채팅
scripts/
  smoke-llm.ts   # 모델 연동 스모크 테스트
```

## 로드맵

- [x] **Phase 1** — 위젯 셸 + 픽셀 강아지 + 말풍선 UI
- [x] **Phase 2** — 국내 LLM 연동 (Solar Pro 2 · A.X-K1 · K-EXAONE · 믿:음 2.0 실배선, VARCO 대기), 스트리밍 채팅 + 액션별 모델 라우팅
- [x] **Phase 3** — 선택 텍스트 캡처(드래그 → ⌥+Space로 강아지가 물고 등장), 코드 감지 배지·액션 자동 실행, 손쉬운 사용 권한 안내
- [ ] **Phase 4** — 우클릭 "MADI 부르기"(macOS 서비스), 히스토리, 설정, 자료조사
