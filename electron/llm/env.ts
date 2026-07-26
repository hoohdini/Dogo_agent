import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * .env.local 로더 — dotenv 없이 최소 구현.
 * 프로젝트 루트(개발 시 cwd)의 .env.local을 읽어 process.env에 채운다.
 * 이미 설정된 환경변수는 덮어쓰지 않는다.
 */
export function loadEnv(rootDir: string = process.cwd()): void {
  let raw: string;
  try {
    raw = readFileSync(join(rootDir, ".env.local"), "utf8");
  } catch {
    return; // 파일 없음 — requireEnv에서 친절한 에러를 낸다
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function requireEnv(name: string, hint: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 비어 있습니다. ${hint}`);
  return value;
}
