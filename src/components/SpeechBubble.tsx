import type { ReactNode } from "react";

/** XP 도우미 느낌의 말풍선 — 꼬리가 오른쪽 아래(강아지 쪽)를 향한다 */
export function SpeechBubble({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}): React.JSX.Element {
  return (
    <div className="bubble">
      {onClose && (
        <button className="bubble-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      )}
      {children}
      <div className="bubble-tail-border" />
      <div className="bubble-tail" />
    </div>
  );
}
