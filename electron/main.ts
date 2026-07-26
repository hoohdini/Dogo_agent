import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from "electron";
import { join } from "node:path";
import { trayIconPng } from "./icon";
import { loadEnv } from "./llm/env";
import { streamChat } from "./llm/stream";
import { captureSelection, isAccessibilityGranted, requestAccessibility } from "./selection";
import type { ChatStartPayload, ShownPayload } from "../shared/ipc";

/**
 * MADI 데스크톱 위젯 셸.
 * - 투명·프레임리스·항상 위 창을 화면 우하단에 배치
 * - 평소엔 숨김, ⌥+Space(전역 단축키) 또는 메뉴바 아이콘으로 호출
 */

const WINDOW_W = 440;
const WINDOW_H = 620;
const MARGIN = 16;
const SHORTCUT = "Alt+Space";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: WINDOW_W,
    height: WINDOW_H,
    x: workArea.x + workArea.width - WINDOW_W - MARGIN,
    y: workArea.y + workArea.height - WINDOW_H - MARGIN,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/preload.mjs"),
      sandbox: false, // ESM preload는 sandbox 미지원 (contextIsolation은 기본 ON)
    },
  });

  // 풀스크린 앱 위에서도 보이도록
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }

  win.on("closed", () => {
    win = null;
  });
}

/** 우하단 기준 위치로 재정렬 (디스플레이 변경·해상도 변경 대응) */
function repositionToCorner(): void {
  if (!win) return;
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win.setPosition(
    workArea.x + workArea.width - WINDOW_W - MARGIN,
    workArea.y + workArea.height - WINDOW_H - MARGIN
  );
}

/**
 * MADI 호출. capture=true면 창을 띄우기 "전에" — 사용자가 보던 앱이
 * 아직 앞에 있을 때 — 선택 텍스트를 캡처해서 함께 넘긴다.
 */
async function showMadi(capture: boolean): Promise<void> {
  if (!win) createWindow();
  if (!win) return;
  const selection = capture ? await captureSelection() : null;
  repositionToCorner();
  win.show();
  win.focus();
  // 기본은 클릭 통과 — 렌더러가 강아지/말풍선 위에 마우스가 올라오면 해제한다.
  // forward: true라 통과 중에도 mousemove는 렌더러에 전달된다.
  win.setIgnoreMouseEvents(true, { forward: true });
  const payload: ShownPayload = {
    selection,
    accessibilityGranted: isAccessibilityGranted(),
  };
  win.webContents.send("madi:shown", payload);
}

function hideMadi(): void {
  win?.hide();
}

function toggleMadi(): void {
  if (win?.isVisible()) hideMadi();
  else void showMadi(true);
}

function createTray(): void {
  const icon = nativeImage.createFromBuffer(trayIconPng());
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("MADI — AI 도우미");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "MADI 부르기 / 숨기기", accelerator: SHORTCUT, click: toggleMadi },
      { type: "separator" },
      { label: "종료", role: "quit" },
    ])
  );
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => void showMadi(false));

  void app.whenReady().then(() => {
    // Dock 아이콘 없이 메뉴바 상주 앱으로 동작
    if (process.platform === "darwin") app.dock.hide();

    createWindow();
    createTray();

    if (!globalShortcut.register(SHORTCUT, toggleMadi)) {
      console.warn(`[MADI] 전역 단축키 등록 실패: ${SHORTCUT} (다른 앱이 사용 중일 수 있음)`);
    }

    // 개발 편의: dev 모드에선 바로 보여준다
    if (process.env.ELECTRON_RENDERER_URL) {
      win?.webContents.once("did-finish-load", () => void showMadi(false));
    }
  });
}

ipcMain.on("madi:hide", hideMadi);

// 손쉬운 사용 권한 요청: 시스템 프롬프트 + 설정 화면 열기.
// 목록에 자동으로 안 뜨는 경우가 많아, + 버튼에서 바로 붙여넣을 수 있게
// 실행 중인 앱 번들(.app) 경로를 클립보드에 복사해둔다.
ipcMain.on("madi:request-accessibility", () => {
  requestAccessibility();
  const appIndex = process.execPath.indexOf(".app/");
  if (appIndex !== -1) {
    clipboard.writeText(process.execPath.slice(0, appIndex + 4));
  }
  void shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
  );
});

// 누끼 클릭 통과: 투명 영역은 뒤 창으로, 강아지·말풍선 위에서만 이벤트 수신
ipcMain.on("madi:set-ignore-mouse", (_event, ignore: boolean) => {
  win?.setIgnoreMouseEvents(ignore, { forward: true });
});

// 강아지 드래그로 창 옮기기 (-webkit-app-region은 mouse 이벤트를 삼켜서 수동 구현)
let dragOrigin: [number, number] | null = null;

ipcMain.on("madi:drag-start", () => {
  dragOrigin = win ? (win.getPosition() as [number, number]) : null;
});

ipcMain.on("madi:drag-move", (_event, delta: { dx: number; dy: number }) => {
  if (win && dragOrigin) {
    win.setPosition(Math.round(dragOrigin[0] + delta.dx), Math.round(dragOrigin[1] + delta.dy));
  }
});

// ── 채팅 스트리밍 IPC ──────────────────────────────────────
loadEnv();

const activeChats = new Map<string, () => void>();

ipcMain.on("chat:start", (event, payload: ChatStartPayload) => {
  const { requestId } = payload;
  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };
  const cancel = streamChat(payload, {
    onDelta: (text) => send("chat:event", { type: "delta", requestId, text }),
    onDone: () => {
      activeChats.delete(requestId);
      send("chat:event", { type: "done", requestId });
    },
    onError: (message) => {
      activeChats.delete(requestId);
      console.error(`[chat/${payload.modelId}]`, message);
      send("chat:event", { type: "error", requestId, message });
    },
  });
  activeChats.set(requestId, cancel);
});

ipcMain.on("chat:abort", (_event, requestId: string) => {
  activeChats.get(requestId)?.();
  activeChats.delete(requestId);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// 트레이 상주 앱: 창이 모두 닫혀도 종료하지 않는다 (리스너 존재 자체가 기본 종료를 막음)
app.on("window-all-closed", () => {
  /* keep alive */
});
