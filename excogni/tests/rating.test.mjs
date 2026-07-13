import { percentError, estimationScore, standardError } from '../src/lib/server/rating/index.ts';
// Dependency-free sanity tests for the rating module.
// Run: node --experimental-strip-types tests/rating.test.mjs  (Node >= 22)
import {
  effectiveElapsedMs, speedClass, scoreAttempt, nextLevel, stableLevel,
  computeRating, percentileOf, confidence
} from '../src/lib/server/rating/index.ts';

let failures = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures++; console.error(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
};
const ok = (name, cond) => {
  if (!cond) { failures++; console.error(`FAIL ${name}`); } else console.log(`ok   ${name}`);
};

// --- timing integrity ---
eq('spoofed-tiny client floored by network credit', effectiveElapsedMs({ clientElapsedMs: 50, serverElapsedMs: 4000 }), 3400);
eq('client within network credit passes', effectiveElapsedMs({ clientElapsedMs: 3500, serverElapsedMs: 4000 }), 3500);
eq('client above server clamped', effectiveElapsedMs({ clientElapsedMs: 9000, serverElapsedMs: 4000 }), 4000);
eq('missing client uses server', effectiveElapsedMs({ clientElapsedMs: null, serverElapsedMs: 5000 }), 5000);
eq('capped at 120s', effectiveElapsedMs({ clientElapsedMs: 500000, serverElapsedMs: 600000 }), 120000);
eq('cannot shave more than network credit', effectiveElapsedMs({ clientElapsedMs: 1000, serverElapsedMs: 5000 }), 4400);
eq('small server time floored to min human', effectiveElapsedMs({ clientElapsedMs: 100, serverElapsedMs: 400 }), 300);

// --- speed classes ---
const cfg = { expectedMedianMs: 5000 };
eq('fast', speedClass(3000, cfg), 'fast');
eq('normal', speedClass(5000, cfg), 'normal');
eq('slow', speedClass(9000, cfg), 'slow');

// --- scoring ---
eq('wrong is 0', scoreAttempt(false, 1000, cfg), 0);
ok('fast correct near 1', scoreAttempt(true, 2500, cfg) >= 0.9);
const normalScore = scoreAttempt(true, 5000, cfg);
ok('normal correct ~0.75', normalScore > 0.7 && normalScore < 0.8);
eq('very slow correct floors at 0.45', scoreAttempt(true, 60000, cfg), 0.45);
ok('slow correct beats wrong', scoreAttempt(true, 60000, cfg) > 0);

// --- ladder ---
const base = { minLevel: 1, maxLevel: 15, previousWasWrong: false };
eq('fast correct +2', nextLevel({ ...base, currentLevel: 5, correct: true, speed: 'fast' }), 7);
eq('normal correct +1', nextLevel({ ...base, currentLevel: 5, correct: true, speed: 'normal' }), 6);
eq('slow correct still advances +1', nextLevel({ ...base, currentLevel: 5, correct: true, speed: 'slow' }), 6);
eq('wrong -1', nextLevel({ ...base, currentLevel: 5, correct: false, speed: 'normal' }), 4);
eq('second consecutive wrong -2', nextLevel({ ...base, currentLevel: 5, correct: false, speed: 'normal', previousWasWrong: true }), 3);
eq('clamped at max', nextLevel({ ...base, currentLevel: 15, correct: true, speed: 'fast' }), 15);
eq('clamped at min', nextLevel({ ...base, currentLevel: 1, correct: false, speed: 'slow', previousWasWrong: true }), 1);

// --- stable level ---
const recent = [
  ...Array(4).fill({ level: 6, correct: true, score: 0.8 }),
  ...Array(3).fill({ level: 7, correct: true, score: 0.7 }),
  { level: 8, correct: false, score: 0 },
  { level: 8, correct: false, score: 0 }
];
eq('stable picks highest qualifying level', stableLevel(recent, 8), 7);
eq('stable falls back below current', stableLevel([], 5), 4);

// --- rating monotonicity ---
const mk = (level, acc, n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    level, correct: i < Math.round(acc * n), score: i < Math.round(acc * n) ? 0.8 : 0
  }));
const low = computeRating(3, mk(3, 0.7));
const high = computeRating(9, mk(9, 0.7));
ok('higher stable level -> higher rating', high > low);
const lowAcc = computeRating(6, mk(6, 0.55));
const highAcc = computeRating(6, mk(6, 0.9));
ok('higher accuracy -> higher rating', highAcc > lowAcc);
ok('ratings land in plausible band', low >= 600 && high <= 1900);
console.log(`   sample ratings: stable3/70% -> ${low}, stable9/70% -> ${high}`);

// --- percentile + confidence ---
eq('percentile needs pool >= 5', percentileOf(1200, [1000, 1100]), null);
eq('percentile basic', percentileOf(1200, [900, 1000, 1100, 1300, 1400]), 60);
eq('confidence low', confidence(5), 'low');
eq('confidence medium', confidence(15), 'medium');
eq('confidence high', confidence(50), 'high');


// --- estimation scoring ---
eq('percentError exact', percentError(100, 100), 0);
eq('percentError half', percentError(150, 100), 0.5);
eq('percentError handles zero true', percentError(5, 0), 5);
ok('estimation cold-start: exact ~1.0', estimationScore(0, []) >= 0.99);
ok('estimation cold-start: closer scores higher', estimationScore(0.1, []) > estimationScore(0.5, []));
eq('estimation ranks against pool', estimationScore(0.2, [0.5, 0.4, 0.3, 0.1, 0.05]), 0.6);
ok('estimation: beating everyone ~1.0', estimationScore(0.01, [0.5, 0.4, 0.3, 0.2, 0.1]) === 1);
ok('estimation: worst scores ~0', estimationScore(0.9, [0.5, 0.4, 0.3, 0.2, 0.1]) === 0);


// --- standard error of measurement ---
ok('SEM shrinks with attempts', standardError(50) < standardError(10));
ok('SEM positive', standardError(20) > 0);
ok('SEM wide when few attempts', standardError(5) > standardError(40));


// --- stableLevel depth ---
// needs >= 3 attempts at a level to qualify
eq('2 attempts not enough to qualify', stableLevel([
  { level: 6, correct: true, score: 0.8 },
  { level: 6, correct: true, score: 0.8 }
], 5), 4); // falls back to currentLevel-1
// needs >= 65% accuracy
eq('below 65% accuracy does not qualify', stableLevel([
  { level: 6, correct: true, score: 0.7 },
  { level: 6, correct: false, score: 0 },
  { level: 6, correct: false, score: 0 }
], 5), 4);
// exactly 65% qualifies (2/3 ~ 0.667)
eq('exactly 2/3 qualifies', stableLevel([
  { level: 6, correct: true, score: 0.7 },
  { level: 6, correct: true, score: 0.7 },
  { level: 6, correct: false, score: 0 }
], 5), 6);
// picks highest among multiple qualifying levels
eq('highest qualifying among several', stableLevel([
  ...Array(3).fill({ level: 4, correct: true, score: 0.8 }),
  ...Array(3).fill({ level: 7, correct: true, score: 0.8 })
], 8), 7);
// fallback never below 1
eq('fallback floored at 1', stableLevel([], 1), 1);

// --- computeRating depth ---
eq('empty recent -> 0', computeRating(8, []), 0);
ok('rating clamped to floor', computeRating(0, [{ level: 1, correct: false, score: 0 }]) >= 600);
ok('rating clamped to ceiling', computeRating(20, Array(5).fill({ level: 20, correct: true, score: 1 })) <= 1900);
// higher stable level -> higher rating (all else equal)
const sameRecent = Array(5).fill({ level: 5, correct: true, score: 0.8 });
ok('higher stable -> higher rating', computeRating(10, sameRecent) > computeRating(5, sameRecent));
// higher accuracy -> higher rating
const hi = Array(5).fill({ level: 5, correct: true, score: 0.8 });
const lo = [...Array(2).fill({ level: 5, correct: true, score: 0.8 }), ...Array(3).fill({ level: 5, correct: false, score: 0 })];
ok('higher accuracy -> higher rating', computeRating(5, hi) > computeRating(5, lo));

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
