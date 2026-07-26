/** 가져온 텍스트가 코드처럼 보이는지 간단 휴리스틱 판별 */
export function looksLikeCode(text: string): boolean {
  const lines = text.split("\n");
  let score = 0;
  if (/[{};]/.test(text)) score += 1;
  if (
    /\b(function|const|let|var|import|export|def|class|return|if|for|while|async|await|public|private)\b/.test(
      text
    )
  ) {
    score += 2;
  }
  if (/=>|===|!==|:=|<\/|\/>|\)\s*{|\(\)|\[\]/.test(text)) score += 1;
  if (lines.filter((l) => /^\s{2,}\S/.test(l)).length >= 2) score += 1;
  return score >= 2;
}
