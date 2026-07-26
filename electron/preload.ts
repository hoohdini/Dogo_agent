import { contextBridge, ipcRenderer } from "electron";

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
};

export type MadiApi = typeof api;

contextBridge.exposeInMainWorld("madi", api);
