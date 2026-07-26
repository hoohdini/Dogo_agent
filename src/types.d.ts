import type { ChatEvent, ChatStartPayload, ShownPayload } from "../shared/ipc";

/** preload가 노출하는 API — Electron 밖(브라우저 데모)에서는 undefined */
declare global {
  interface Window {
    madi?: {
      hide(): void;
      onShown(callback: (payload: ShownPayload) => void): () => void;
      requestAccessibility(): void;
      setIgnoreMouse(ignore: boolean): void;
      dragStart(): void;
      dragMove(dx: number, dy: number): void;
      chatStart(payload: ChatStartPayload): void;
      chatAbort(requestId: string): void;
      onChatEvent(callback: (event: ChatEvent) => void): () => void;
    };
  }
}

export {};
