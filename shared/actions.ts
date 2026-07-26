import type { ModelId } from "./models";

/**
 * 말풍선 액션 선택지 정의.
 * model: 작업별 기본 라우팅 (채팅 패널에서 수동 변경 가능)
 * instruction: 사용자의 첫 입력을 감싸는 작업 지시 (null이면 자유 채팅)
 */
export interface ActionDef {
  id: string;
  icon: string;
  label: string;
  model: ModelId;
  instruction: string | null;
  /** 입력창 placeholder */
  inputHint: string;
}

export const ACTIONS: ActionDef[] = [
  {
    id: "explain",
    icon: "🔍",
    label: "설명해줘",
    model: "k-exaone",
    instruction:
      "다음 내용을 이해하기 쉽게 설명해줘. 코드라면 동작 원리를, 개념이라면 핵심을 예시와 함께 설명해줘.",
    inputHint: "설명이 필요한 코드나 개념을 붙여넣어 주세요",
  },
  {
    id: "spellcheck",
    icon: "✏️",
    label: "맞춤법 검사",
    model: "midm-2.0",
    instruction:
      "다음 글의 맞춤법·띄어쓰기·어색한 표현을 교정해줘. 먼저 교정된 전체 문장을 보여주고, 그 아래에 고친 부분과 이유를 짧게 정리해줘.",
    inputHint: "검사할 문장을 붙여넣어 주세요",
  },
  {
    id: "summarize",
    icon: "📝",
    label: "요약해줘",
    model: "ax-k1",
    instruction: "다음 내용을 핵심만 3~5줄로 요약해줘.",
    inputHint: "요약할 내용을 붙여넣어 주세요",
  },
  {
    id: "translate",
    icon: "🌐",
    label: "번역해줘",
    model: "solar-pro2",
    instruction:
      "다음 내용을 번역해줘. 한국어면 자연스러운 영어로, 다른 언어면 자연스러운 한국어로 번역해줘.",
    inputHint: "번역할 내용을 붙여넣어 주세요",
  },
  {
    id: "chat",
    icon: "💬",
    label: "그냥 채팅",
    model: "solar-pro2",
    instruction: null,
    inputHint: "무엇이든 물어보세요",
  },
];

/** MADI 강아지 페르소나 — 모든 요청 공통 시스템 프롬프트 */
export const SYSTEM_PROMPT = `너는 MADI(마디), 화면 구석에 사는 픽셀 강아지 AI 도우미야.
- 한국어로 친근하고 간결하게 답해. 말풍선에 들어가는 답이니 장황하게 늘어놓지 마.
- 마크다운 서식(#, **, 표) 없이 평문으로 답해. 목록이 필요하면 "- "만 써.
- 정확함이 우선이고, 모르면 모른다고 말해.
- 가끔 답 끝에 🐾 를 붙여도 좋지만 남발하지 마.`;
