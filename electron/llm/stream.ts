import type { ChatMessage, ChatStartPayload } from "../../shared/ipc";
import type { ModelId } from "../../shared/models";
import { requireEnv } from "./env";

/**
 * 국내 LLM 5종 OpenAI 호환 스트리밍 (메인 프로세스 전용).
 * MADI_LLM의 models.ts/retry.ts/rate-limit.ts 제약을 raw fetch로 이식:
 * - SKT A.X-K1: 팀 공유 키 RPS 3 → 호출 직렬화(최소 간격 350ms) + 1s→2s→4s 재시도
 * - Friendli(K-EXAONE·믿:음): model 필드에 모델명이 아니라 Endpoint ID
 * - thinking 계열은 chat_template_kwargs로 기본 OFF (속도 우선)
 */

interface ProviderConfig {
  url: string;
  apiKey: () => string;
  model: () => string;
  extraBody?: Record<string, unknown>;
  maxOutputTokens: number;
  /** 히스토리 조립 시 입력 문자 수 상한 (SKT/믿:음은 권장 입력이 작다) */
  inputCharBudget: number;
  retries: number;
  serialize?: boolean; // SKT 직렬화 큐
  totalTimeoutMs: number;
  chunkTimeoutMs: number;
}

const FRIENDLI_URL = "https://api.friendli.ai/dedicated/v1/chat/completions";

const PROVIDERS: Record<Exclude<ModelId, "varco">, ProviderConfig> = {
  "solar-pro2": {
    url: "https://api.upstage.ai/v1/chat/completions",
    apiKey: () => requireEnv("UPSTAGE_API_KEY", ".env.local에 Upstage 키(up_...)를 넣어주세요."),
    model: () => "solar-pro2",
    maxOutputTokens: 2048,
    inputCharBudget: 60_000,
    retries: 2,
    totalTimeoutMs: 120_000,
    chunkTimeoutMs: 60_000,
  },
  "ax-k1": {
    url: "https://awf-gw.adot.ai/v1/chat/completions",
    apiKey: () => requireEnv("SKT_AX_API_KEY", ".env.local에 SKT 키(awf_...)를 넣어주세요."),
    model: () => "A.X-K1", // 대소문자 정확히
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
    maxOutputTokens: 2048,
    inputCharBudget: 16_000,
    retries: 3,
    serialize: true,
    totalTimeoutMs: 180_000,
    chunkTimeoutMs: 90_000,
  },
  "k-exaone": {
    url: FRIENDLI_URL,
    apiKey: () => requireEnv("FRIENDLI_TOKEN", ".env.local에 Friendli 토큰(flp_...)을 넣어주세요."),
    model: () =>
      requireEnv("FRIENDLI_KEXAONE_ENDPOINT_ID", "K-EXAONE Friendli Endpoint ID가 필요합니다."),
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
    maxOutputTokens: 2048,
    inputCharBudget: 60_000,
    retries: 2,
    totalTimeoutMs: 120_000,
    chunkTimeoutMs: 60_000,
  },
  "midm-2.0": {
    url: FRIENDLI_URL,
    apiKey: () =>
      requireEnv("FRIENDLI_MIDM_TOKEN", ".env.local에 믿:음용 Friendli 토큰이 필요합니다."),
    model: () =>
      requireEnv("FRIENDLI_MIDM_ENDPOINT_ID", "믿:음 Friendli Endpoint ID가 필요합니다."),
    maxOutputTokens: 2048,
    inputCharBudget: 16_000,
    retries: 2,
    totalTimeoutMs: 120_000,
    chunkTimeoutMs: 60_000,
  },
};

// ── SKT 직렬화 큐 (RPS 3 → 동시 1개, 시작 간격 350ms) ──────────
let sktChain: Promise<unknown> = Promise.resolve();
let sktLastStart = 0;

function serializeSkt<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = sktLastStart + 350 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    sktLastStart = Date.now();
    return task();
  };
  const next = sktChain.then(run, run);
  sktChain = next.catch(() => undefined);
  return next;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 히스토리를 문자 예산 안으로 자른다 (system + 최신 메시지 우선) */
function trimMessages(messages: ChatMessage[], budget: number): ChatMessage[] {
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  let used = system.reduce((n, m) => n + m.content.length, 0);
  const kept: ChatMessage[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    used += rest[i].content.length;
    if (used > budget && kept.length > 0) break;
    kept.unshift(rest[i]);
  }
  return [...system, ...kept];
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** 스트리밍 채팅 실행. 반환된 함수를 호출하면 중단된다. */
export function streamChat(payload: ChatStartPayload, cb: StreamCallbacks): () => void {
  const abort = new AbortController();
  void run(payload, cb, abort).catch((err: unknown) => {
    cb.onError(err instanceof Error ? err.message : String(err));
  });
  return () => abort.abort();
}

async function run(
  payload: ChatStartPayload,
  cb: StreamCallbacks,
  abort: AbortController
): Promise<void> {
  if (payload.modelId === "varco") {
    cb.onError("VARCO는 아직 준비 중인 모델이에요. 다른 모델을 선택해주세요.");
    return;
  }
  const config = PROVIDERS[payload.modelId];

  const doFetch = (): Promise<Response> =>
    fetch(config.url, {
      method: "POST",
      signal: abort.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey()}`,
      },
      body: JSON.stringify({
        model: config.model(),
        messages: trimMessages(payload.messages, config.inputCharBudget),
        stream: true,
        max_tokens: config.maxOutputTokens,
        temperature: 0.7,
        ...config.extraBody,
      }),
    });

  // 첫 응답까지 재시도 (429/5xx/네트워크 오류 → 1s/2s/4s 지수 백오프)
  let response: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = config.serialize ? await serializeSkt(doFetch) : await doFetch();
      if (res.ok) {
        response = res;
        break;
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= config.retries) {
        const body = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`API 오류 (HTTP ${res.status}) ${body}`);
      }
      console.warn(`[llm/${payload.modelId}] 재시도 ${attempt + 1}/${config.retries} (HTTP ${res.status})`);
    } catch (err) {
      if (abort.signal.aborted) return;
      if (err instanceof Error && err.message.startsWith("API 오류")) throw err;
      if (attempt >= config.retries) throw err;
      console.warn(`[llm/${payload.modelId}] 재시도 ${attempt + 1}/${config.retries} (네트워크 오류)`);
    }
    await sleep(1000 * 2 ** attempt);
  }

  if (!response.body) throw new Error("응답 스트림이 비어 있습니다.");

  // 전체/청크 무응답 타임아웃
  const totalTimer = setTimeout(() => abort.abort(), config.totalTimeoutMs);
  let chunkTimer = setTimeout(() => abort.abort(), config.chunkTimeoutMs);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(chunkTimer);
      chunkTimer = setTimeout(() => abort.abort(), config.chunkTimeoutMs);

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.trim();
        if (!data.startsWith("data:")) continue;
        const json = data.slice(5).trim();
        if (json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
          };
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) {
            emitted = true;
            cb.onDelta(text);
          }
        } catch {
          // 불완전한 JSON 조각은 무시
        }
      }
    }
    if (!emitted) {
      cb.onError("모델이 빈 응답을 보냈어요. 다시 시도해주세요.");
      return;
    }
    cb.onDone();
  } catch (err) {
    if (abort.signal.aborted && emitted) {
      // 타임아웃/중단 — 여기까지 받은 내용으로 마무리
      cb.onDone();
    } else if (!abort.signal.aborted) {
      throw err;
    }
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(chunkTimer);
    reader.releaseLock();
  }
}
