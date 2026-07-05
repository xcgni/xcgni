// THE METHODOLOGY VERSION.
//
// This is the single, addressable identifier for "how Excogni computes a cognitive profile" - the
// thing a researcher would cite. It bundles, conceptually: the scoring formulas, the rating algorithm
// and its constants, and the rule for which challenges count toward an official score (the canonical
// tier). Every result is stamped with the version it was computed under, so a score is always
// interpretable and reproducible - and so changing a formula mints a NEW version rather than silently
// rewriting the meaning of past scores.
//
// DISCIPLINE: bump METHODOLOGY_VERSION whenever ANY of the following change in a way that affects an
// official score - scoring formulas, the rating algorithm or its constants, the calibration/insight
// thresholds, or which challenge types are canonical. Add a changelog entry. Never reuse a version
// number for a different computation. Treat published versions as immutable.

export const METHODOLOGY_VERSION = 'm1';

export interface MethodologyConstants {
  // rating
  ratingAlgorithm: string;
  provisionalAttempts: number;     // attempts until a category rating is no longer provisional
  highConfidenceAttempts: number;  // attempts until high confidence
  // validity gates
  insightMinSessions: number;      // distinct practice days before insights are computed
  populationMinCell: number;       // floor below which public cells are suppressed
  // scoring
  minHumanMs: number;              // floor below which a response is treated as non-human-fast
  tooFastMs: number;               // quality flag threshold
}

export interface MethodologyVersion {
  version: string;
  released: string;          // the app version that introduced this methodology
  status: 'current' | 'superseded';
  summary: string;
  constants: MethodologyConstants;
  changes: string[];
}

// The registry of methodology versions, newest first. Older entries are frozen historical records.
export const METHODOLOGY_REGISTRY: MethodologyVersion[] = [
  {
    version: 'm1',
    released: 'v0.63.0',
    status: 'current',
    summary:
      'First addressable methodology. Per-domain Excogni Ratings from speed-and-accuracy ' +
      'scoring on convergent tasks, plus a speed-ignoring "deliberate" scorer for strategic/planning ' +
      'tasks. Ratings are population-anchored; insights are honesty-gated; only canonical-tier ' +
      'challenges contribute to official scores.',
    constants: {
      ratingAlgorithm: 'per-domain adaptive rating (Excogni Rating), percentile-anchored to the population',
      provisionalAttempts: 10,
      highConfidenceAttempts: 30,
      insightMinSessions: 20,
      populationMinCell: 50,
      minHumanMs: 300,
      tooFastMs: 250
    },
    changes: [
      'Initial canonical methodology.',
      'The per-domain score is the "Excogni Rating" - an adaptive, single-player rating inspired by ' +
        'competitive systems like Elo, but distinct from them: there are no opponents. It estimates ' +
        'ability from calibrated task difficulty, response accuracy and time, and population ' +
        'normalization (closer in spirit to adaptive psychometrics than to head-to-head Elo).',
      'Convergent scoring: speed-weighted correct-answer score with a slow-correct floor.',
      'Deliberate scoring: speed ignored; score reflects solution optimality (planning/strategy).',
      'Per-attempt quality flags (too-fast, AFK, first-exposure) recorded but never deleted.',
      'Experimental-tier challenges collect data but do NOT affect official ratings.',
      'Estimation: one continuous normalized-error axis (|guess-true|/max(|true|,1)), scored by ' +
        'population rank on the same item (>=5 peers) with a 1/(1+4e) cold-start; no discrete ' +
        '"close enough" tiers. Fluency: min(1, valid/12), per-word validity disclosed. Reaction: ' +
        'band, never a point estimate.'
    ]
  }
];

export function currentMethodology(): MethodologyVersion {
  return METHODOLOGY_REGISTRY.find((m) => m.version === METHODOLOGY_VERSION) ?? METHODOLOGY_REGISTRY[0];
}
