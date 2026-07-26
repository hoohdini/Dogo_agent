import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIONS, type ActionDef } from "../shared/actions";
import { looksLikeCode } from "../shared/detect";
import { ChatPanel } from "./components/ChatPanel";
import { Mascot, type Pose } from "./components/Mascot";
import { SpeechBubble } from "./components/SpeechBubble";

/**
 * 상태 흐름:
 * hidden → (호출) → entering(달려옴) → greeting(인사) → menu(선택지)
 *   → chat(채팅 패널, 강아지 포즈는 스트리밍 상태를 따라감)
 */
type Stage = "hidden" | "entering" | "greeting" | "menu" | "chat";

const RUN_IN_MS = 1300;
const GREETING_MS = 1400;

const isElectron = typeof window !== "undefined" && !!window.madi;

export function App(): React.JSX.Element {
  const [stage, setStage] = useState<Stage>("hidden");
  const [action, setAction] = useState<ActionDef | null>(null);
  const [chatPose, setChatPose] = useState<Pose>("idle");
  const [selection, setSelection] = useState<string | null>(null);
  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const [a11yGranted, setA11yGranted] = useState(true);
  const timers = useRef<number[]>([]);
  const dragging = useRef(false);

  const selectionIsCode = selection ? looksLikeCode(selection) : false;

  // 누끼 클릭 통과: 강아지·말풍선 위에서만 마우스 이벤트를 받는다
  const solidProps = isElectron
    ? {
        onMouseEnter: () => window.madi!.setIgnoreMouse(false),
        onMouseLeave: () => {
          if (!dragging.current) window.madi!.setIgnoreMouse(true);
        },
      }
    : {};

  /** 강아지 드래그로 창 이동 (app-region: drag는 마우스 이벤트를 삼켜서 수동 구현) */
  const onDogMouseDown = (e: React.MouseEvent): void => {
    if (!isElectron) return;
    e.preventDefault();
    dragging.current = true;
    const startX = e.screenX;
    const startY = e.screenY;
    window.madi!.dragStart();
    const onMove = (ev: MouseEvent): void => {
      window.madi!.dragMove(ev.screenX - startX, ev.screenY - startY);
    };
    const onUp = (ev: MouseEvent): void => {
      dragging.current = false;
      // 강아지 밖에서 놓았으면 다시 클릭 통과 상태로
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!el?.closest(".dog-area, .bubble-slot")) window.madi!.setIgnoreMouse(true);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  /** 등장 시퀀스: 달려오기 → 인사 → 메뉴 */
  const enter = useCallback(() => {
    clearTimers();
    setAction(null);
    setStage("entering");
    after(RUN_IN_MS, () => {
      setStage("greeting");
      after(GREETING_MS, () => setStage("menu"));
    });
  }, [after, clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setStage("hidden");
    setAction(null);
    setSelection(null);
    window.madi?.hide();
  }, [clearTimers]);

  // Electron: 메인 프로세스의 show 알림(선택 텍스트 포함) → 등장. 브라우저 데모: 바로 등장.
  useEffect(() => {
    if (isElectron) {
      const off = window.madi!.onShown((payload) => {
        setSelection(payload.selection);
        setClipboardText(payload.clipboardText);
        setA11yGranted(payload.accessibilityGranted);
        enter();
      });
      return off;
    }
    // 데모: ?sel=텍스트(선택 캡처), ?clip=텍스트(클립보드 폴백) 시뮬레이션
    const params = new URLSearchParams(location.search);
    const demoSel = params.get("sel");
    if (demoSel) setSelection(demoSel);
    const demoClip = params.get("clip");
    if (demoClip) setClipboardText(demoClip);
    enter();
    return undefined;
  }, [enter]);

  // Esc: 채팅 중이면 메뉴로, 아니면 숨기기
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (stage === "chat") {
        setStage("menu");
        setAction(null);
        setChatPose("idle");
      } else {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, close]);

  const openAction = (a: ActionDef): void => {
    clearTimers();
    setAction(a);
    setChatPose("idle");
    setStage("chat");
  };

  const pose: Pose =
    stage === "entering"
      ? "run"
      : stage === "greeting"
        ? "talk"
        : stage === "chat"
          ? chatPose
          : "idle";

  const showBubble = stage === "greeting" || stage === "menu" || stage === "chat";

  return (
    <div className="app">
      {stage === "hidden" && !isElectron && (
        <button className="demo-summon" onClick={enter}>
          🐾 MADI 부르기 (데모)
        </button>
      )}

      <div className="stack">
        <div className={`bubble-slot ${showBubble ? "visible" : ""}`} {...solidProps}>
          {showBubble && (
            <SpeechBubble onClose={close} wide={stage === "chat"}>
              {stage === "greeting" ? (
                <p className="bubble-text">
                  {selection ? "멍! 텍스트를 물고 왔어요! 🐾" : "멍! 부르셨어요? 🐾"}
                </p>
              ) : stage === "menu" ? (
                <>
                  <p className="bubble-title">
                    {selection ? "이 텍스트, 어떻게 도와드릴까요?" : "무엇을 도와드릴까요?"}
                  </p>
                  {selection && (
                    <div className="selection-preview">
                      <div className="selection-meta">
                        <span>
                          📋 {selection.length.toLocaleString()}자
                          {selectionIsCode && <span className="code-badge">코드</span>}
                        </span>
                        <button
                          className="selection-clear"
                          onClick={() => setSelection(null)}
                          aria-label="가져온 텍스트 지우기"
                        >
                          지우기
                        </button>
                      </div>
                      <pre className={selectionIsCode ? "mono" : ""}>
                        {selection.slice(0, 150)}
                        {selection.length > 150 ? " …" : ""}
                      </pre>
                    </div>
                  )}
                  {!selection && clipboardText && (
                    <button
                      className="clipboard-suggest"
                      onClick={() => setSelection(clipboardText)}
                    >
                      📋 클립보드 텍스트 가져오기 ({clipboardText.length.toLocaleString()}자)
                      <span className="clipboard-peek">
                        {clipboardText.slice(0, 60)}
                        {clipboardText.length > 60 ? " …" : ""}
                      </span>
                    </button>
                  )}
                  <ul className="action-list">
                    {(selectionIsCode
                      ? [...ACTIONS].sort((a, b) =>
                          a.id === "explain" ? -1 : b.id === "explain" ? 1 : 0
                        )
                      : ACTIONS
                    ).map((a) => (
                      <li key={a.id}>
                        <button className="action-chip" onClick={() => openAction(a)}>
                          <span className="chip-arrow">▸</span>
                          <span className="chip-icon">{a.icon}</span>
                          {a.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {isElectron && !a11yGranted && (
                    <button
                      className="a11y-notice"
                      onClick={() => window.madi!.requestAccessibility()}
                    >
                      🔒 드래그한 텍스트를 물고 오려면 손쉬운 사용 권한이 필요해요
                      <br />
                      <u>여기를 눌러 시스템 설정 열기</u> — 목록에 앱이 없으면 + 버튼 →
                      ⌘⇧G → 붙여넣기(경로 복사해둘게요) → 추가 후 켜기
                    </button>
                  )}
                </>
              ) : (
                action && (
                  <ChatPanel
                    key={action.id}
                    action={action}
                    initialText={selection}
                    onPoseChange={setChatPose}
                    onBack={() => {
                      setStage("menu");
                      setAction(null);
                      setChatPose("idle");
                    }}
                  />
                )
              )}
            </SpeechBubble>
          )}
        </div>

        {stage !== "hidden" && (
          <div className="dog-area" {...solidProps} onMouseDown={onDogMouseDown}>
            <div className={`dog ${stage === "entering" ? "dog-entering" : ""}`}>
              <Mascot pose={pose} />
            </div>
            <div className="dog-shadow" />
          </div>
        )}
      </div>
    </div>
  );
}
