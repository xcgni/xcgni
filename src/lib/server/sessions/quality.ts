// Compute quality flags for an attempt. The philosophy: never silently drop a questionable
// answer - flag it so validity analysis can exclude it while the raw record is preserved. These
// flags are what let early-user data stay analysable forever (exclude flagged rows, keep the rest).
//
// Pure and unit-tested: no DB, no side effects.

export interface FlagInput {
  effectiveMs: number;          // the timing we scored on
  clientElapsedMs: number | null;
  serverElapsedMs: number | null;
  expectedMedianMs: number | null; // the challenge's expected median, if known
  isFirstExposure: boolean;     // user's first ever attempt at this challenge type
}

// Below this, a "response" is faster than genuine human perception+decision+motor for these tasks.
// ~250 ms is a common floor for simple reaction; for tasks needing reading/decision it's higher,
// but we keep a conservative absolute floor so we only flag the clearly-impossible.
export const TOO_FAST_MS = 250;

// A response that takes wildly longer than expected is likely AFK / distracted / tab-switched.
// Relative to the challenge's own expected median when we have it, with an absolute backstop.
export const TOO_SLOW_ABSOLUTE_MS = 120_000; // 2 minutes
export const TOO_SLOW_MULTIPLE = 12;          // > 12x the expected median

// If client and server timings disagree wildly, the client clock/instrumentation is untrusted.
export const CLOCK_DISAGREE_MS = 5_000;

export function computeQualityFlags(input: FlagInput): string[] {
  const flags: string[] = [];
  const { effectiveMs, clientElapsedMs, serverElapsedMs, expectedMedianMs, isFirstExposure } = input;

  if (effectiveMs > 0 && effectiveMs < TOO_FAST_MS) flags.push('too_fast');

  const slowByMultiple =
    expectedMedianMs != null && expectedMedianMs > 0 && effectiveMs > expectedMedianMs * TOO_SLOW_MULTIPLE;
  if (effectiveMs > TOO_SLOW_ABSOLUTE_MS || slowByMultiple) flags.push('too_slow');

  if (isFirstExposure) flags.push('first_exposure');

  if (
    clientElapsedMs != null &&
    serverElapsedMs != null &&
    Math.abs(clientElapsedMs - serverElapsedMs) > CLOCK_DISAGREE_MS
  ) {
    flags.push('client_clock');
  }

  return flags;
}
