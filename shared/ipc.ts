import type { ModelId } from "./models";

/** 렌더러 ↔ 메인 채팅 IPC 계약 */

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
