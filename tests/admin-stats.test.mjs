// Dependency-free tests for the admin statistics primitives.
// Run: node --experimental-strip-types tests/admin-stats.test.mjs
import {
  summarize, compare, multipleComparisons, suppressCount, testRetestReliability,
  benjaminiHochberg, cliffsDelta, proportionGap
} from '../src/lib/server/admin/stats.ts';

let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }
function near(name, a, b, eps = 0.02) { ok(name + ` (${a} ~ ${b})`, Math.abs(a - b) <= eps); }

// summarize
const s = summarize([10, 12, 14, 16, 18]);
ok('summarize n', s.n === 5);
near('summarize mean', s.mean, 14);
ok('summarize median', s.median === 14);
ok('summarize min/max', s.min === 10 && s.max === 18);
ok('summarize ci present', s.ci95 != null);
ok('empty summarize safe', summarize([]).mean === null);

// suppression
ok('suppress below floor', suppressCount(19, 20) === null);
ok('suppress at floor', suppressCount(20, 20) === 20);

// compare + effect size
const big = compare(
  [100, 102, 98, 101, 99, 103, 97, 100, 101, 99, 100, 102, 98, 101, 99, 103, 97, 100, 101, 99],
  [110, 112, 108, 111, 109, 113, 107, 110, 111, 109, 110, 112, 108, 111, 109, 113, 107, 110, 111, 109],
  20
);
ok('compare not suppressed (n>=20)', big.suppressed === false);
ok('compare detects direction', big.meanDiff < 0);
ok('compare large effect', big.effectLabel === 'large');

const suppressed = compare([1, 2, 3], [4, 5, 6], 20);
ok('compare suppressed below floor', suppressed.suppressed === true);
ok('suppressed has no effect size', suppressed.cohensD === null);

// negligible effect
const negl = compare(
  Array.from({ length: 30 }, (_, i) => 100 + (i % 3)),
  Array.from({ length: 30 }, (_, i) => 100 + (i % 3)),
  20
);
ok('identical groups negligible', negl.effectLabel === 'negligible');

// multiple comparisons
const mc = multipleComparisons(10);
ok('mc warns at >=5', mc.warn === true);
ok('mc inflates FP rate', mc.familywiseFalsePositiveRate > 0.05);
ok('mc bonferroni tighter', mc.bonferroniThreshold < 0.05);
ok('mc single comparison no warn', multipleComparisons(1).warn === false);

// test-retest reliability
const consistent = testRetestReliability(
  Array.from({ length: 10 }, (_, i) => [1000 + i * 50, 1005 + i * 50, 995 + i * 50])
);
ok('reliability computed with enough subjects', consistent.icc != null);
ok('consistent data high ICC', consistent.icc > 0.7);

const noisy = testRetestReliability(
  Array.from({ length: 10 }, () => [Math.random() * 2000, Math.random() * 2000])
);
ok('noisy data lower ICC', noisy.icc == null || noisy.icc < 0.7);

ok('reliability needs >=5 subjects', testRetestReliability([[1, 2], [3, 4]]).icc === null);


// --- Benjamini-Hochberg FDR ---
const bh = benjaminiHochberg([0.001, 0.01, 0.04, 0.5, 0.8], 0.05);
ok('BH flags smallest p-values', bh.significant[0] === true);
ok('BH rejects large p-values', bh.significant[4] === false);
ok('BH empty safe', benjaminiHochberg([], 0.05).threshold === null);

// --- Cliff's delta ---
const cdBig = cliffsDelta([10,11,12,13,14], [1,2,3,4,5]);
ok('cliffs delta detects separation', cdBig.delta > 0.9);
ok('cliffs delta large label', cdBig.label === 'large');
const cdNone = cliffsDelta([5,5,5], [5,5,5]);
ok('cliffs delta zero on identical', cdNone.delta === 0);
ok('cliffs delta negligible label', cdNone.label === 'negligible');

// --- proportion gap (consent bias) ---
const pgBig = proportionGap({ yes: 80, n: 100 }, { yes: 40, n: 100 });
ok('proportion gap notable', pgBig.notable === true);
ok('proportion gap value', Math.abs(pgBig.gap - 0.4) < 0.001);
const pgSmall = proportionGap({ yes: 5, n: 10 }, { yes: 4, n: 10 });
ok('proportion gap suppressed below floor', pgSmall.gap === null);

// --- reliability now returns CI ---
const rel = testRetestReliability(Array.from({ length: 8 }, (_, i) => [1000 + i*40, 1010 + i*40]));
ok('reliability has ci95', Array.isArray(rel.ci95));

console.log(failures === 0 ? '\nALL ADMIN TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
