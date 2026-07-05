// All scoring/rating logic lives here, isolated and dependency-free
// so it can be unit-tested without a database.

export type SpeedClass = 'fast' | 'normal' | 'slow';

export interface ScoringConfig {
  expectedMedianMs: number;
  slowCorrectFloorScore?: number; // default 0.45
  fastCorrectScore?: number; // default 1.0
}

export interface TimingInput {
  clientElapsedMs: number | null;
  serverElapsedMs: number; // submitted_at - served_at, authoritative upper bound
}

// Bump when scoring logic changes so historical attempts can be segmented cleanly.
export const SCORING_MODEL_VERSION = 1;

export const MIN_HUMAN_MS = 300; // nobody reads + answers faster than this
export const MAX_SCORED_MS = 120_000; // cap so an abandoned tab doesn't skew medians
export const MAX_NETWORK_CREDIT_MS = 600; // most network round-trips a client may "subtract"

/**
 * Timing integrity. The SERVER-measured elapsed (submitted_at - served_at) is the
 * authority - a client cannot report a faster time than the server observed. The
 * only thing the client time may do is subtract genuine network/transport latency,
 * and only up to MAX_NETWORK_CREDIT_MS. So:
 *   - a spoofed tiny client time can shave at most MAX_NETWORK_CREDIT_MS, not the
 *     whole response (it can never beat server_time - cap);
 *   - the result is always clamped into [MIN_HUMAN_MS, serverElapsed].
 * This removes the old hole where any client time below the server bound was
 * trusted outright, letting a user under-report their true response time.
 */
export function effectiveElapsedMs(t: TimingInput): number {
  const serverBound = Math.max(t.serverElapsedMs, MIN_HUMAN_MS);
  // the most we'll ever credit for network/transport between server and client
  const flooredByNetwork = Math.max(MIN_HUMAN_MS, serverBound - MAX_NETWORK_CREDIT_MS);
  let ms = t.clientElapsedMs;
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    // no usable client time - use the server bound directly
    return Math.min(Math.max(Math.round(serverBound), MIN_HUMAN_MS), MAX_SCORED_MS);
  }
  // client may pull the time down, but never below the network-credited floor
  // and never above what the server actually observed
  ms = Math.max(ms, flooredByNetwork);
  ms = Math.min(ms, serverBound);
  ms = Math.max(ms, MIN_HUMAN_MS);
  return Math.min(Math.round(ms), MAX_SCORED_MS);
}

export function speedClass(effectiveMs: number, cfg: ScoringConfig): SpeedClass {
  const ratio = effectiveMs / cfg.expectedMedianMs;
  if (ratio <= 0.7) return 'fast';
  if (ratio <= 1.6) return 'normal';
  return 'slow';
}

/**
 * Score in [0, 1]. Wrong = 0. Correct slides from ~1.0 (fast) down to a floor
 * (default 0.45) for very slow - slow correct is never treated as wrong.
 * Calibration: ratio 0.5 -> ~0.90, ratio 1.0 -> ~0.75, ratio >= ~2.0 -> floor.
 */
export function scoreAttempt(correct: boolean, effectiveMs: number, cfg: ScoringConfig): number {
  if (!correct) return 0;
  const floor = cfg.slowCorrectFloorScore ?? 0.45;
  const top = cfg.fastCorrectScore ?? 1.0;
  const ratio = effectiveMs / cfg.expectedMedianMs;
  const raw = 1.06 - 0.31 * ratio;
  return Math.round(Math.min(top, Math.max(floor, raw)) * 1000) / 1000;
}

/**
 * Deliberate / strategic scoring. For planning tasks, thinking slowly is a VIRTUE, not a cost - so
 * speed is ignored entirely. The score reflects solution QUALITY: a correct solution scores high,
 * and (when an optimal move/step count is known) closer-to-optimal scores higher. This is what lets
 * the radar reward the careful, planning, "measure twice" thinker the speed scorer would penalise.
 *
 *  - correct + optimal (moves <= optimal): 1.0
 *  - correct but longer than optimal: slides down toward a floor as it gets less efficient
 *  - correct with no known optimum: full credit (we only have "solved it")
 *  - incorrect/unsolved: 0
 */
export function scoreDeliberate(
  correct: boolean,
  opts?: { moves?: number; optimalMoves?: number; floor?: number }
): number {
  if (!correct) return 0;
  const floor = opts?.floor ?? 0.5;
  const { moves, optimalMoves } = opts ?? {};
  if (moves == null || optimalMoves == null || optimalMoves <= 0) return 1.0;
  if (moves <= optimalMoves) return 1.0;
  // efficiency: optimal/actual, mapped into [floor, 1]
  const efficiency = optimalMoves / moves; // in (0,1]
  return Math.round((floor + (1 - floor) * efficiency) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Estimation scoring - single error axis, ranked against the population.
// ---------------------------------------------------------------------------

/** Normalized absolute error: |guess - true| / max(|true|, 1). 0 = exact. */
export function percentError(guess: number, trueValue: number): number {
  return Math.abs(guess - trueValue) / Math.max(Math.abs(trueValue), 1);
}

/**
 * Estimation score in [0,1]. Your error is ranked against the population's
 * errors on the SAME challenge: score = fraction of others you beat (smaller
 * error). With no population yet, fall back to a smooth curve on percent error
 * so early users still get a sensible, monotone score (closer = higher).
 * No tiers of miss - one continuous axis, exactly as specified.
 */
export function estimationScore(myError: number, othersErrors: number[]): number {
  if (othersErrors.length >= 5) {
    const beaten = othersErrors.filter((e) => e > myError).length;
    const s = beaten / othersErrors.length;
    return Math.round(Math.max(0, Math.min(1, s)) * 1000) / 1000;
  }
  // cold-start fallback: 0 error -> 1.0, 25% error -> ~0.5, >=100% -> ~0
  const s = 1 / (1 + myError * 4);
  return Math.round(Math.max(0, Math.min(1, s)) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Adaptive ladder
// ---------------------------------------------------------------------------

export interface LadderInput {
  currentLevel: number;
  correct: boolean;
  speed: SpeedClass;
  previousWasWrong: boolean; // consecutive failures stabilize downward faster
  minLevel: number;
  maxLevel: number;
}

export function nextLevel(i: LadderInput): number {
  // Design: a correct answer always advances you - getting it right is the competence
  // signal. Speed only changes HOW FAST you climb (and is fully reflected in the rating
  // via scoreAttempt), it never blocks progression. Failure is what normalizes the level
  // downward, finding your true ceiling.
  let delta = 0;
  if (i.correct && i.speed === 'fast') delta = 2;       // right and quick - climb fast
  else if (i.correct) delta = 1;                         // right (normal OR slow) - still climb
  else delta = i.previousWasWrong ? -2 : -1;             // wrong - normalize down
  return Math.max(i.minLevel, Math.min(i.maxLevel, i.currentLevel + delta));
}

// ---------------------------------------------------------------------------
// Stable level + rating
// ---------------------------------------------------------------------------

export interface RecentAttempt {
  level: number;
  correct: boolean;
  score: number;
}

/**
 * Stable level = highest level, within the recent window, where the user has
 * at least 3 attempts and >= 65% accuracy. Falls back to just below the
 * current level when nothing qualifies yet.
 */
export function stableLevel(recent: RecentAttempt[], currentLevel: number): number {
  const byLevel = new Map<number, { n: number; c: number }>();
  for (const a of recent) {
    const e = byLevel.get(a.level) ?? { n: 0, c: 0 };
    e.n++;
    if (a.correct) e.c++;
    byLevel.set(a.level, e);
  }
  let best = 0;
  for (const [level, e] of byLevel) {
    if (e.n >= 3 && e.c / e.n >= 0.65 && level > best) best = level;
  }
  return best > 0 ? best : Math.max(1, currentLevel - 1);
}

/**
 * Provisional rating. Norm-referencing happens through the percentile pool;
 * this number is a stable, monotone summary of (level, accuracy, speed).
 * Roughly: stable level dominates, recent accuracy and speed shade it.
 * Typical range ~700-1750 to align with the simulated population.
 */
export function computeRating(stable: number, recent: RecentAttempt[]): number {
  if (recent.length === 0) return 0;
  const acc = recent.filter((a) => a.correct).length / recent.length;
  const correctScores = recent.filter((a) => a.correct).map((a) => a.score);
  const avgSpeedScore = correctScores.length
    ? correctScores.reduce((s, x) => s + x, 0) / correctScores.length
    : 0.6;
  const r = 700 + stable * 52 + (acc - 0.6) * 380 + (avgSpeedScore - 0.7) * 260;
  return Math.max(600, Math.min(1900, Math.round(r)));
}

export type Confidence = 'low' | 'medium' | 'high';

export function confidence(attemptsCount: number): Confidence {
  if (attemptsCount < 10) return 'low';
  if (attemptsCount < 30) return 'medium';
  return 'high';
}

/**
 * Standard error of measurement for an individual rating, in rating points.
 * A psychometrician's ask: a score is never a point, it's a point ± SEM. SEM
 * shrinks as attempts accumulate (more evidence -> tighter estimate). With few
 * attempts the band is wide; this makes the uncertainty visible instead of
 * implying false precision. Returns a half-width to render rating ± sem.
 */
export function standardError(attemptsCount: number): number {
  // heuristic: wide early, asymptotes low. ~180 at n=5, ~90 at n=20, ~55 at n=50.
  if (attemptsCount < 1) return 250;
  return Math.round(400 / Math.sqrt(attemptsCount + 3));
}

/**
 * Percentile of `rating` within a pool. Returns null when the pool is too
 * small to mean anything - callers render an honest "calibrating" state
 * instead of a fabricated number.
 */
export function percentileOf(rating: number, pool: number[], minPool = 5): number | null {
  if (pool.length < minPool) return null;
  const below = pool.filter((r) => r < rating).length;
  return Math.round((below / pool.length) * 100);
}

/**
 * Ordinal suffix for clean wording, e.g. 1st, 2nd, 3rd, 11th, 92nd.
 */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * The single approved percentile phrasing. No more "Top X% · Yth percentile".
 * e.g. percentileWording(92) -> "92nd percentile · higher than 92% of rated users"
 */
export function percentileWording(percentile: number): string {
  return `${ordinal(percentile)} percentile · higher than ${percentile}% of rated users`;
}
