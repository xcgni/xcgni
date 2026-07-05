// Pure answer validation, dependency-free so it can be unit-tested and reused.
// Tolerances that matter: decimal comma (European input), spaces in digit-span
// answers, and numeric vs string equality for choice indices.

export function validateAnswer(answerData: unknown, given: string): boolean {
  if (answerData == null || typeof answerData !== 'object') return false;
  const data = answerData as { correctAnswer?: number | string; acceptedAnswers?: string[] };
  const norm = given.trim().replace(',', '.'); // tolerate decimal comma
  const stripped = norm.replace(/\s+/g, ''); // digit-span answers may be typed with spaces
  if (Array.isArray(data.acceptedAnswers) &&
      (data.acceptedAnswers.includes(norm) || data.acceptedAnswers.includes(stripped))) return true;
  if (data.correctAnswer !== undefined) {
    const num = Number(norm);
    if (Number.isFinite(num) && norm !== '' && Number(data.correctAnswer) === num) return true;
    if (String(data.correctAnswer) === norm) return true;
  }
  return false;
}
