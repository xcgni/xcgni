import type { PageServerLoad } from './$types';
import { METHODOLOGY_REGISTRY, currentMethodology } from '$lib/methodology';
import {
  SCORING_MODEL_VERSION, MIN_HUMAN_MS, MAX_SCORED_MS, MAX_NETWORK_CREDIT_MS,
  effectiveElapsedMs, speedClass, scoreAttempt, standardError,
  confidence, percentileOf, percentError
} from '$lib/server/rating';
import { MIN_POOL_FOR_PERCENTILE } from '$lib/server/flags';

export const load: PageServerLoad = async () => {
  // live worked examples, computed by the ACTUAL scoring functions (radical transparency)
  const cfg = { expectedMedianMs: 4000, slowCorrectFloorScore: 0.45, fastCorrectScore: 1.0 };
  const scoreCurve = [0.4, 0.7, 1.0, 1.6, 2.5].map((ratio) => {
    const ms = Math.round(ratio * cfg.expectedMedianMs);
    return { ratio, ms, speed: speedClass(ms, cfg), score: scoreAttempt(true, ms, cfg) };
  });
  const timingExamples = [
    { label: 'normal answer', client: 3500 as number | null, server: 4000 },
    { label: 'spoofed-fast client', client: 50, server: 4000 },
    { label: 'client slower than server', client: 9000, server: 4000 },
    { label: 'no client time', client: null, server: 5000 }
  ].map((t) => ({ ...t, effective: effectiveElapsedMs({ clientElapsedMs: t.client, serverElapsedMs: t.server }) }));
  const semExamples = [1, 3, 10, 30, 100].map((n) => ({ attempts: n, sem: standardError(n), confidence: confidence(n) }));
  const samplePool = [
    760, 820, 880, 920, 950, 1010, 1060, 1100, 1140, 1180,
    1210, 1250, 1290, 1320, 1360, 1400, 1440, 1480, 1540, 1600, 1680, 1740
  ];
  const percentileExamples = [900, 1250, 1500].map((r) => ({ rating: r, percentile: percentileOf(r, samplePool, MIN_POOL_FOR_PERCENTILE) }));
  const estimationExamples = [
    { guess: 100, truth: 100 }, { guess: 110, truth: 100 }, { guess: 150, truth: 100 }
  ].map((e) => ({ ...e, pctError: percentError(e.guess, e.truth) }));

  return {
    current: currentMethodology(),
    registry: METHODOLOGY_REGISTRY,
    formulas: {
      constants: {
        SCORING_MODEL_VERSION, MIN_HUMAN_MS, MAX_SCORED_MS, MAX_NETWORK_CREDIT_MS,
        MIN_POOL_FOR_PERCENTILE, RATING_MIN: 600, RATING_MAX: 1900
      },
      cfg, scoreCurve, timingExamples, semExamples, percentileExamples, estimationExamples, samplePool
    }
  };
};
