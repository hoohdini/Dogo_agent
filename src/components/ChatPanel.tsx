import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionDef } from "../../shared/actions";
import { SYSTEM_PROMPT } from "../../shared/actions";
import { MODEL_CATALOG, type ModelId } from "../../shared/models";
import type { ChatMessage } from "../../shared/ipc";
import type { Pose } from "./Mascot";

/** 화면에 보여주는 메시지 (에러는 role: "error") */
interface DisplayMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

const isElectron = typeof window !== "undefined" && !!window.madi;

export function ChatPanel({
  action,
  initialText,
  onPoseChange,
  onBack,
}: {
  action: ActionDef;
  /** 호출 시 물고 온 선택 텍스트 — 지시가 있는 액션이면 즉시 실행, 자유 채팅이면 입력창에 프리필 */
  initialText?: string | null;
  onPoseChange: (pose: Pose) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState<ModelId>(action.model);
  const [streaming, setStreaming] = useState(false);

  /** API로 보내는 히스토리 — 첫 메시지에 액션 지시가 붙어 화면용과 다를 수 있다 */
  const apiHistory = useRef<ChatMessage[]>([]);
  const requestId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mockTimer = useRef<number | null>(null);

  // 새 메시지·스트리밍 중 자동 스크롤
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const appendDelta = useCallback((text: string) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") {
        next[next.length - 1] = { role: "assistant", content: last.content + text };
      }
      return next;
    });
  }, []);

  const finish = useCallback(
    (assistantText: string | null, errorMessage?: string) => {
      setStreaming(false);
      requestId.current = null;
      onPoseChange("idle");
      if (assistantText !== null) {
        apiHistory.current.push({ role: "assistant", content: assistantText });
      }
      if (errorMessage) {
        setMessages((prev) => {
          // 비어 있는 assistant 자리표시자는 지우고 에러를 보여준다
          const next = prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content));
          return [...next, { role: "error", content: errorMessage }];
        });
      }
      inputRef.current?.focus();
    },
    [onPoseChange]
  );

  // 스트리밍 이벤트 구독 (Electron)
  const assistantAccum = useRef("");
  useEffect(() => {
    if (!isElectron) return;
    const off = window.madi!.onChatEvent((event) => {
      if (event.requestId !== requestId.current) return;
      if (event.type === "delta") {
        if (!assistantAccum.current) onPoseChange("talk"); // 첫 토큰: 생각 → 말하기
        assistantAccum.current += event.text;
        appendDelta(event.text);
      } else if (event.type === "done") {
        finish(assistantAccum.current || null);
      } else {
        finish(assistantAccum.current || null, event.message);
      }
    });
    return off;
  }, [appendDelta, finish, onPoseChange]);

  const sendText = (raw: string): void => {
    const text = raw.trim();
    if (!text || streaming) return;

    // 첫 메시지에는 액션 지시를 붙인다 (화면에는 입력 원문만 표시)
    const isFirst = apiHistory.current.length === 0;
    const apiContent =
      isFirst && action.instruction ? `${action.instruction}\n\n${text}` : text;
    apiHistory.current.push({ role: "user", content: apiContent });

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);
    assistantAccum.current = "";
    onPoseChange("think");

    if (!isElectron) {
      // 브라우저 데모: 가짜 스트리밍
      const demo = `(데모 모드) Electron 앱에서 실행하면 ${modelId} 모델이 실제로 답해요! 입력하신 내용: "${text}"`;
      let i = 0;
      onPoseChange("talk");
      mockTimer.current = window.setInterval(() => {
        appendDelta(demo.slice(i, i + 2));
        i += 2;
        if (i >= demo.length) {
          if (mockTimer.current) window.clearInterval(mockTimer.current);
          finish(demo);
        }
      }, 30);
      return;
    }

    const id = crypto.randomUUID();
    requestId.current = id;
    window.madi!.chatStart({
      requestId: id,
      modelId,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...apiHistory.current],
    });
  };

  const send = (): void => sendText(input);

  // 물고 온 텍스트: 지시가 있는 액션(맞춤법 등)은 즉시 실행, 자유 채팅은 프리필만
  const autoSent = useRef(false);
  useEffect(() => {
    if (!initialText || autoSent.current) return;
    autoSent.current = true;
    if (action.instruction) sendText(initialText);
    else setInput(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = (): void => {
    if (requestId.current) window.madi?.chatAbort(requestId.current);
    if (mockTimer.current) window.clearInterval(mockTimer.current);
    finish(assistantAccum.current || null);
  };

  // 패널을 떠날 때 진행 중 요청 정리
  useEffect(
    () => () => {
      if (requestId.current) window.madi?.chatAbort(requestId.current);
      if (mockTimer.current) window.clearInterval(mockTimer.current);
    },
    []
  );

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <button className="chat-back" onClick={onBack} aria-label="메뉴로">
          ◂
        </button>
        <span className="chat-title">
          {action.icon} {action.label}
        </span>
        <select
          className="model-select"
          value={modelId}
          onChange={(e) => setModelId(e.target.value as ModelId)}
          disabled={streaming}
        >
          {MODEL_CATALOG.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.enabled}>
              {m.label}
              {m.enabled ? "" : " (준비 중)"}
            </option>
          ))}
        </select>
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-empty">{action.inputHint}</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            {m.content ||
              (m.role === "assistant" && streaming ? (
                <span className="cursor-blink">▌</span>
              ) : (
                m.content
              ))}
          </div>
        ))}
      </div>

      <div className="chat-input-row">
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          placeholder={action.inputHint}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {streaming ? (
          <button className="chat-send stop" onClick={stop}>
            ■
          </button>
        ) : (
          <button className="chat-send" onClick={send} disabled={!input.trim()}>
            ▶
          </button>
        )}
      </div>
    </div>
  );
}
