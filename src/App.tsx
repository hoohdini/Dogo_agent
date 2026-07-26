import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIONS, type ActionDef } from "../shared/actions";
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
  const timers = useRef<number[]>([]);

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
    window.madi?.hide();
  }, [clearTimers]);

  // Electron: 메인 프로세스의 show 알림 → 등장. 브라우저 데모: 바로 등장.
  useEffect(() => {
    if (isElectron) {
      const off = window.madi!.onShown(() => enter());
      return off;
    }
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
        <div className={`bubble-slot ${showBubble ? "visible" : ""}`}>
          {showBubble && (
            <SpeechBubble onClose={close} wide={stage === "chat"}>
              {stage === "greeting" ? (
                <p className="bubble-text">멍! 부르셨어요? 🐾</p>
              ) : stage === "menu" ? (
                <>
                  <p className="bubble-title">무엇을 도와드릴까요?</p>
                  <ul className="action-list">
                    {ACTIONS.map((a) => (
                      <li key={a.id}>
                        <button className="action-chip" onClick={() => openAction(a)}>
                          <span className="chip-arrow">▸</span>
                          <span className="chip-icon">{a.icon}</span>
                          {a.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                action && (
                  <ChatPanel
                    key={action.id}
                    action={action}
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
          <div className="dog-area">
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
