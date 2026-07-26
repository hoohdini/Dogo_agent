import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from "electron";
import { join } from "node:path";
import { trayIconPng } from "./icon";

/**
 * MADI 데스크톱 위젯 셸.
 * - 투명·프레임리스·항상 위 창을 화면 우하단에 배치
 * - 평소엔 숨김, ⌥+Space(전역 단축키) 또는 메뉴바 아이콘으로 호출
 */

const WINDOW_W = 420;
const WINDOW_H = 500;
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

function showMadi(): void {
  if (!win) createWindow();
  if (!win) return;
  repositionToCorner();
  win.show();
  win.focus();
  win.webContents.send("madi:shown");
}

function hideMadi(): void {
  win?.hide();
}

function toggleMadi(): void {
  if (win?.isVisible()) hideMadi();
  else showMadi();
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
  app.on("second-instance", showMadi);

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
      win?.webContents.once("did-finish-load", showMadi);
    }
  });
}

ipcMain.on("madi:hide", hideMadi);

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// 트레이 상주 앱: 창이 모두 닫혀도 종료하지 않는다 (리스너 존재 자체가 기본 종료를 막음)
app.on("window-all-closed", () => {
  /* keep alive */
});
