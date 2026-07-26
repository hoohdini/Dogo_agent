import { useCallback, useEffect, useRef, useState } from "react";
import { Mascot, type Pose } from "./components/Mascot";
import { SpeechBubble } from "./components/SpeechBubble";

/**
 * Phase 1 상태 흐름:
 * hidden → (호출) → entering(달려옴) → greeting(인사) → menu(선택지)
 *   → thinking(응답 준비 데모) → talking(안내) → menu ...
 */
type Stage = "hidden" | "entering" | "greeting" | "menu" | "thinking" | "talking";

const RUN_IN_MS = 1300;
const GREETING_MS = 1400;
const THINKING_MS = 900;
const TALKING_MS = 3000;

const ACTIONS = [
  { icon: "🔍", label: "설명해줘" },
  { icon: "✏️", label: "맞춤법 검사" },
  { icon: "📝", label: "요약해줘" },
  { icon: "🌐", label: "번역해줘" },
  { icon: "💬", label: "그냥 채팅" },
] as const;

const POSE_BY_STAGE: Record<Stage, Pose> = {
  hidden: "idle",
  entering: "run",
  greeting: "talk",
  menu: "idle",
  thinking: "think",
  talking: "talk",
};

const isElectron = typeof window !== "undefined" && !!window.madi;

export function App(): React.JSX.Element {
  const [stage, setStage] = useState<Stage>("hidden");
  const [message, setMessage] = useState("");
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
    setStage("entering");
    after(RUN_IN_MS, () => {
      setMessage("멍! 부르셨어요? 🐾");
      setStage("greeting");
      after(GREETING_MS, () => setStage("menu"));
    });
  }, [after, clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setStage("hidden");
    window.madi?.hide();
  }, [clearTimers]);

  // Electron: 메인 프로세스의 show 알림 → 등장. 브라우저 데모: 바로 등장.
  useEffect(() => {
    if (isElectron) {
      const off = window.madi!.onShown(enter);
      return off;
    }
    enter();
    return undefined;
  }, [enter]);

  // Esc로 숨기기
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const runAction = (label: string): void => {
    clearTimers();
    setStage("thinking");
    after(THINKING_MS, () => {
      setMessage(`"${label}" 기능은 Phase 2에서 AI 모델과 연결될 예정이에요! 조금만 기다려주세요 🐾`);
      setStage("talking");
      after(TALKING_MS, () => setStage("menu"));
    });
  };

  const showBubble = stage !== "hidden" && stage !== "entering";

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
            <SpeechBubble onClose={close}>
              {stage === "menu" ? (
                <>
                  <p className="bubble-title">무엇을 도와드릴까요?</p>
                  <ul className="action-list">
                    {ACTIONS.map((a) => (
                      <li key={a.label}>
                        <button className="action-chip" onClick={() => runAction(a.label)}>
                          <span className="chip-arrow">▸</span>
                          <span className="chip-icon">{a.icon}</span>
                          {a.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : stage === "thinking" ? (
                <p className="bubble-text thinking-dots">
                  <span>·</span>
                  <span>·</span>
                  <span>·</span>
                </p>
              ) : (
                <p className="bubble-text">{message}</p>
              )}
            </SpeechBubble>
          )}
        </div>

        {stage !== "hidden" && (
          <div className="dog-area">
            <div className={`dog ${stage === "entering" ? "dog-entering" : ""}`}>
              <Mascot pose={POSE_BY_STAGE[stage]} />
            </div>
            <div className="dog-shadow" />
          </div>
        )}
      </div>
    </div>
  );
}
