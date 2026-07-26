import type { ModelId } from "./models";

/** 렌더러 ↔ 메인 IPC 계약 */

/** 창이 보여질 때 렌더러로 전달되는 정보 */
export interface ShownPayload {
  /** 호출 직전 앞 앱에서 캡처한 선택 텍스트 (없거나 권한 없으면 null) */
  selection: string | null;
  /**
   * 드래그 캡처가 안 됐을 때의 폴백 — 현재 클립보드 텍스트.
   * 오래된 민감 정보일 수 있으니 자동 사용하지 않고 버튼으로 명시 선택하게 한다.
   */
  clipboardText: string | null;
  /** macOS 손쉬운 사용 권한 여부 */
  accessibilityGranted: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatStartPayload {
  requestId: string;
  modelId: ModelId;
  messages: ChatMessage[];
}

export type ChatEvent =
  | { type: "delta"; requestId: string; text: string }
  | { type: "done"; requestId: string }
  | { type: "error"; requestId: string; message: string };
