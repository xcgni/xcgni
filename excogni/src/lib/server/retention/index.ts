// Spaced-repetition scheduling (SM-2 family) + honest retention scoring.
// Dependency-free and unit-tested.
//
// The honesty principle: a card is a MEASUREMENT only when it was genuinely DUE
// - i.e. the interval had grown long enough that recall is a real test. Re-seeing
// a freshly-missed card is training and does not count toward the retention score.

export interface CardState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export interface ScheduleResult {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  nextDueMs: number; // ms from now until next due
}

const DAY_MS = 24 * 3600 * 1000;
const MIN_EASE = 1.3;

/**
 * Update scheduling from a graded recall.
 * grade: 0 = forgot, 1 = hard (slow/uncertain), 2 = good, 3 = easy.
 * Mirrors SM-2: failures reset the interval and add a lapse; successes grow the
 * interval by the ease factor; ease drifts with difficulty.
 */
export function schedule(state: CardState, grade: 0 | 1 | 2 | 3): ScheduleResult {
  let { ease, intervalDays, reps, lapses } = state;

  if (grade === 0) {
    reps = 0;
    lapses += 1;
    intervalDays = 0; // re-learn soon (same session / minutes)
    ease = Math.max(MIN_EASE, ease - 0.2);
    return { ease, intervalDays, reps, lapses, nextDueMs: 60 * 1000 }; // ~1 min
  }

  // success
  reps += 1;
  if (reps === 1) intervalDays = grade === 3 ? 4 : 1;
  else if (reps === 2) intervalDays = 6;
  else intervalDays = Math.round(intervalDays * ease * 10) / 10;

  // ease adjustment (SM-2 quality mapping: hard lowers, easy raises)
  const q = grade === 1 ? 3 : grade === 2 ? 4 : 5;
  ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  ease = Math.round(ease * 1000) / 1000;

  return { ease, intervalDays, reps, lapses, nextDueMs: Math.max(60 * 1000, intervalDays * DAY_MS) };
}

/** Was this card genuinely due enough to count as a measurement?
 *  A card counts when its interval had grown past the threshold (a real test of
 *  retention, not a re-show of something just seen). */
export function isMeasurementDue(intervalDays: number, thresholdDays = 1): boolean {
  return intervalDays >= thresholdDays;
}

/**
 * Retention mastery score in [0,1] for a user's deck progress. Combines:
 *  - due-recall hit rate (the honest measurement signal), weighted most
 *  - maturity: share of cards at long intervals (truly retained vs still learning)
 * Returns null when there isn't enough due-review evidence yet (calibration honesty).
 */
export function retentionMastery(params: {
  dueReviews: number;
  dueHits: number;
  matureCards: number; // cards with interval >= maturity threshold
  totalSeen: number;
}): number | null {
  const { dueReviews, dueHits, matureCards, totalSeen } = params;
  if (dueReviews < 5 || totalSeen === 0) return null; // not enough to measure honestly
  const hitRate = dueHits / dueReviews;
  const maturity = matureCards / totalSeen;
  // recall dominates; maturity is a secondary credit for durable retention
  const score = 0.8 * hitRate + 0.2 * maturity;
  return Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000;
}

/** Map mastery [0,1] to the shared ~600..1900 rating scale so retention slots
 *  into the same records/radar machinery as the processing categories. */
export function masteryToRating(mastery: number): number {
  return Math.round(600 + mastery * (1900 - 600));
}
