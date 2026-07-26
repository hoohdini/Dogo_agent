/**
 * 모델 카탈로그 — 메인 프로세스와 렌더러가 공유하는 표시 정보.
 * API 키·엔드포인트 등 비밀 값은 electron/llm/* (메인 전용)에만 존재한다.
 */

export type ModelId = "solar-pro2" | "ax-k1" | "k-exaone" | "midm-2.0" | "varco";

export interface ModelInfo {
  id: ModelId;
  label: string;
  vendor: string;
  /** false면 UI에서 "준비 중" 표시 + 선택 불가 */
  enabled: boolean;
}

export const DEFAULT_MODEL_ID: ModelId = "solar-pro2";

export const MODEL_CATALOG: ModelInfo[] = [
  { id: "solar-pro2", label: "Solar Pro 2", vendor: "Upstage", enabled: true },
  { id: "ax-k1", label: "A.X-K1", vendor: "SKT", enabled: true },
  { id: "k-exaone", label: "K-EXAONE", vendor: "LG AI", enabled: true },
  { id: "midm-2.0", label: "믿:음 2.0", vendor: "KT", enabled: true },
  { id: "varco", label: "VARCO", vendor: "NC AI", enabled: false },
];

export function getModelInfo(id: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
