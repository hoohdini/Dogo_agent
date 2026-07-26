import { contextBridge, ipcRenderer } from "electron";
import type { ChatEvent, ChatStartPayload } from "../shared/ipc";

/** 렌더러에 노출하는 최소 API — window.madi */
const api = {
  /** 위젯 숨기기 (Esc / ✕ 버튼) */
  hide(): void {
    ipcRenderer.send("madi:hide");
  },
  /** 메인 프로세스가 창을 보여줄 때 알림 (등장 애니메이션 트리거) */
  onShown(callback: () => void): () => void {
    const listener = (): void => callback();
    ipcRenderer.on("madi:shown", listener);
    return () => {
      ipcRenderer.removeListener("madi:shown", listener);
    };
  },
  /** true면 마우스 이벤트가 뒤 창으로 통과 (투명 영역), false면 이 창이 받음 */
  setIgnoreMouse(ignore: boolean): void {
    ipcRenderer.send("madi:set-ignore-mouse", ignore);
  },
  /** 강아지 드래그로 창 이동 */
  dragStart(): void {
    ipcRenderer.send("madi:drag-start");
  },
  dragMove(dx: number, dy: number): void {
    ipcRenderer.send("madi:drag-move", { dx, dy });
  },
  /** 채팅 스트리밍 시작 */
  chatStart(payload: ChatStartPayload): void {
    ipcRenderer.send("chat:start", payload);
  },
  /** 진행 중인 요청 중단 */
  chatAbort(requestId: string): void {
    ipcRenderer.send("chat:abort", requestId);
  },
  /** 채팅 이벤트(delta/done/error) 구독 */
  onChatEvent(callback: (event: ChatEvent) => void): () => void {
    const listener = (_e: unknown, data: ChatEvent): void => callback(data);
    ipcRenderer.on("chat:event", listener);
    return () => {
      ipcRenderer.removeListener("chat:event", listener);
    };
  },
};

export type MadiApi = typeof api;

contextBridge.exposeInMainWorld("madi", api);
