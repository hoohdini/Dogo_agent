/**
 * LLM 연동 스모크 테스트 — Electron 없이 스트리밍 경로를 그대로 검증한다.
 *   npx tsx scripts/smoke-llm.ts              # solar-pro2
 *   npx tsx scripts/smoke-llm.ts ax-k1        # 특정 모델
 *   npx tsx scripts/smoke-llm.ts all          # 활성 모델 전부 순차
 */
import { loadEnv } from "../electron/llm/env";
import { streamChat } from "../electron/llm/stream";
import { MODEL_CATALOG, type ModelId } from "../shared/models";
import { SYSTEM_PROMPT } from "../shared/actions";

loadEnv();

function testModel(modelId: ModelId): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(`\n── ${modelId} ──────────────\n`);
    const started = Date.now();
    let first = 0;
    streamChat(
      {
        requestId: `smoke-${modelId}`,
        modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: "한 문장으로 자기소개 해줘." },
        ],
      },
      {
        onDelta: (text) => {
          if (!first) first = Date.now() - started;
          process.stdout.write(text);
        },
        onDone: () => {
          process.stdout.write(`\n✅ ${modelId} OK (첫 토큰 ${first}ms, 총 ${Date.now() - started}ms)\n`);
          resolve(true);
        },
        onError: (message) => {
          process.stdout.write(`\n❌ ${modelId} 실패: ${message}\n`);
          resolve(false);
        },
      }
    );
  });
}

const arg = process.argv[2] ?? "solar-pro2";
const targets: ModelId[] =
  arg === "all"
    ? MODEL_CATALOG.filter((m) => m.enabled).map((m) => m.id)
    : [arg as ModelId];

let failed = 0;
for (const id of targets) {
  const ok = await testModel(id);
  if (!ok) failed++;
}
process.exit(failed > 0 ? 1 : 0);
