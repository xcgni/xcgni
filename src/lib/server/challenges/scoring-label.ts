/**
 * Scoring transparency (v1.10.0) - the truth-gated chip. Every served challenge carries a
 * human label of HOW it is scored, derived from the actual scoring mode strings the
 * scorer dispatches on - so the label cannot drift from reality. Answering the fair
 * criticism that pace-scoring without a visible clock reads as hidden measurement: it is
 * not hidden if every item says so.
 */
export function scoringLabel(
  answerMode: string | null | undefined,
  configMode: string | null | undefined
): string {
  const mode = answerMode ?? configMode ?? null;
  switch (mode) {
    case 'deliberate':
      return 'no clock · quality of solution scored';
    case 'fluency_count':
      return 'valid answers counted · fixed time window';
    case 'error_rank':
      return 'closeness scored · pace noted';
    default:
      return 'accuracy scored · pace scored, no visible clock';
  }
}
