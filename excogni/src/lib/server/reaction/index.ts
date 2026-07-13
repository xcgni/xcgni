// Reaction time, measured HONESTLY as a band, never a single number.
//
// The measured time = true_RT + hardware_delay, where hardware_delay (input
// polling + display latency + browser overhead) is unknown and variable. We
// never pretend to know it. Instead we bound the true RT:
//   fast edge = measured - maxPlausibleDelay   (true RT is at least this fast)
//   slow edge = measured - minPlausibleDelay   (true RT is at most this slow)
// A per-user calibration probe (responding to a near-zero-cognition stimulus)
// estimates that user's personal delay floor and the residual uncertainty,
// narrowing the band: a 144Hz wired setup gets a tight band, a laggy touchpad
// a wide one - which is correct, because we genuinely know less about it.

export interface RtCalibration {
  floorMs: number;        // personal min plausible delay (hw+input+display)
  uncertaintyMs: number;  // residual band half-width after calibration
  refreshHz?: number | null;
}

// Sensible defaults before a user has calibrated (conservative, wide band).
export const DEFAULT_CALIBRATION: RtCalibration = { floorMs: 40, uncertaintyMs: 60 };

export interface RtBand {
  fastMs: number;  // lower bound on true RT
  slowMs: number;  // upper bound on true RT
  widthMs: number; // band width = our uncertainty
}

/**
 * Derive a reaction-time band from a measured response time and the user's
 * calibration. The measured time has the delay baked in; we subtract the
 * plausible delay range to bound true RT. Never returns a point estimate.
 */
export function reactionBand(measuredMs: number, cal: RtCalibration): RtBand {
  const minDelay = cal.floorMs;
  const maxDelay = cal.floorMs + 2 * cal.uncertaintyMs;
  // fast edge subtracts the LARGER delay; slow edge subtracts the SMALLER.
  const fast = Math.max(80, Math.round(measuredMs - maxDelay)); // 80ms physiological floor
  const slow = Math.max(fast + 1, Math.round(measuredMs - minDelay));
  return { fastMs: fast, slowMs: slow, widthMs: slow - fast };
}

/**
 * Build a calibration from raw probe samples (measured response times to a
 * near-zero-cognition stimulus). The MINIMUM sample approximates the personal
 * delay floor (fastest the hardware+person can physically respond); the spread
 * of the fastest samples estimates residual uncertainty.
 */
export function calibrateFromProbes(samples: number[], refreshHz?: number | null): RtCalibration {
  if (samples.length < 3) return DEFAULT_CALIBRATION;
  const sorted = [...samples].sort((a, b) => a - b);
  const floor = sorted[0];
  // uncertainty from the spread of the fastest third (robust to lapses)
  const fastThird = sorted.slice(0, Math.max(2, Math.floor(sorted.length / 3)));
  const mean = fastThird.reduce((s, x) => s + x, 0) / fastThird.length;
  const sd = Math.sqrt(fastThird.reduce((s, x) => s + (x - mean) ** 2, 0) / fastThird.length);
  // a refresh-rate contribution: one frame of display latency at most
  const frameMs = refreshHz && refreshHz > 0 ? 1000 / refreshHz : 16.7;
  const uncertainty = Math.max(15, Math.round(sd + frameMs / 2));
  return { floorMs: Math.round(floor), uncertaintyMs: uncertainty, refreshHz: refreshHz ?? null };
}

/**
 * Score for a reaction-time attempt, on the shared 600..1900 scale, derived
 * from the MIDPOINT of the band purely for laddering - the displayed result is
 * always the band, never this internal scalar. Faster midpoint -> higher score.
 */
export function reactionScoreFromBand(band: RtBand): number {
  const mid = (band.fastMs + band.slowMs) / 2;
  // 180ms (elite) -> ~1.0, 600ms (slow) -> ~0.0, clamped
  const s = (600 - mid) / (600 - 180);
  return Math.round(Math.max(0, Math.min(1, s)) * 1000) / 1000;
}
