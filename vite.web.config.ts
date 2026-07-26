// 렌더러만 브라우저에서 띄워 마스코트/말풍선 UI를 빠르게 확인하는 용도.
// (Electron 없이 동작 — window.madi가 없으면 자동으로 데모 모드)
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "src"),
  plugins: [react()],
  server: { port: 5199 },
});
