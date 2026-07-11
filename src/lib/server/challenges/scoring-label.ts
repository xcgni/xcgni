/**
 * Scoring transparency (v1.10.0) - the truth-gated chip. Every served challenge carries a
 * human label of HOW it is scored, derived from the actual scoring mode strings the
 * scorer dispatches on - so the label cannot drift from reality. Answering the fair
 * criticism that pace-scoring without a visible clock reads as hidden measurement: it is
 * not hidden if every item says so.
 */
import { translate, type Locale } from '../../i18n/index.ts';

export function scoringLabel(
  answerMode: string | null | undefined,
  configMode: string | null | undefined,
  locale: Locale = 'en'
): string {
  const mode = answerMode ?? configMode ?? null;
  switch (mode) {
    case 'deliberate':
      return translate(locale, 'scoring.deliberate');
    case 'fluency_count':
      return translate(locale, 'scoring.fluency');
    case 'error_rank':
      return translate(locale, 'scoring.errorRank');
    default:
      return translate(locale, 'scoring.default');
  }
}
