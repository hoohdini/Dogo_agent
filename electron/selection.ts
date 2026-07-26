import { clipboard, systemPreferences } from "electron";
import { execFile } from "node:child_process";

/**
 * 선택 텍스트 캡처 (macOS).
 * 위젯을 띄우기 "전에" — 사용자가 보던 앱이 아직 앞에 있을 때 —
 * Cmd+C를 시뮬레이트해서 선택 영역을 클립보드로 복사해 읽는다.
 * 손쉬운 사용(Accessibility) 권한이 필요하다.
 *
 * 주의: 캡처 동안 클립보드를 비웠다가 텍스트만 복원한다.
 * (이미지 등 다른 형식의 클립보드는 프로토타입에선 복원하지 않음)
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function osascript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function isAccessibilityGranted(): boolean {
  if (process.platform !== "darwin") return false;
  return systemPreferences.isTrustedAccessibilityClient(false);
}

/** 시스템 권한 프롬프트 트리거 (설정 앱으로 안내) */
export function requestAccessibility(): void {
  if (process.platform !== "darwin") return;
  systemPreferences.isTrustedAccessibilityClient(true);
}

const MAX_SELECTION_CHARS = 8000;

/** 폴백용: 현재 클립보드 텍스트 (사용자가 ⌘C로 직접 복사한 경우) */
export function readClipboardText(): string | null {
  const text = clipboard.readText().trim();
  if (!text) return null;
  return text.length > MAX_SELECTION_CHARS
    ? `${text.slice(0, MAX_SELECTION_CHARS)}\n…(길어서 잘렸어요)`
    : text;
}

export async function captureSelection(): Promise<string | null> {
  if (!isAccessibilityGranted()) {
    console.log("[selection] 손쉬운 사용 권한 없음 → 드래그 캡처 생략");
    return null;
  }

  const previous = clipboard.readText();
  clipboard.clear();

  try {
    // 사용자가 단축키(⌥Space)에서 손을 뗄 시간을 잠깐 준다 —
    // ⌥가 눌린 채로 Cmd+C가 들어가면 다른 단축키가 될 수 있다.
    await sleep(140);
    await osascript('tell application "System Events" to keystroke "c" using {command down}');

    // 클립보드 반영 대기 (최대 500ms)
    let captured = "";
    for (let i = 0; i < 10; i++) {
      await sleep(50);
      captured = clipboard.readText();
      if (captured) break;
    }

    if (!captured) {
      console.log("[selection] 클립보드 변화 없음 (선택 없음이거나 Cmd+C 미전달)");
      return null;
    }
    console.log(`[selection] 캡처 성공: ${captured.length}자`);
    if (captured.length > MAX_SELECTION_CHARS) {
      captured = `${captured.slice(0, MAX_SELECTION_CHARS)}\n…(길어서 잘렸어요)`;
    }
    return captured;
  } catch (error) {
    console.warn("[selection] 캡처 실패:", error);
    return null;
  } finally {
    if (previous) clipboard.writeText(previous);
  }
}
