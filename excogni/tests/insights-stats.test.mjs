// Tests for the insights statistics. The honesty gates are the product, so test them hard:
// noise must NOT pass, real effects must pass, and small samples must never pass.

import {
  mean, variance, stdev, welchT, normalCdf, cohenD, compareBuckets, BALANCED
} from '../src/lib/server/insights/stats.ts';

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); }
}
function approx(a, b, eps = 0.02) { return Math.abs(a - b) <= eps; }

// --- basic stats ---
ok('mean', mean([1, 2, 3]) === 2);
ok('mean empty', mean([]) === 0);
ok('variance', approx(variance([2, 4, 6]), 4));
ok('stdev', approx(stdev([2, 4, 6]), 2));

// --- normal CDF sanity ---
ok('normalCdf(0)=0.5', approx(normalCdf(0), 0.5));
ok('normalCdf(1.96)~0.975', approx(normalCdf(1.96), 0.975, 0.005));
ok('normalCdf(-1.96)~0.025', approx(normalCdf(-1.96), 0.025, 0.005));

// --- cohenD ---
{
  // two clearly separated groups => large d
  const a = [0.8, 0.82, 0.78, 0.81, 0.79];
  const b = [0.5, 0.52, 0.48, 0.51, 0.49];
  ok('cohenD large for separated groups', Math.abs(cohenD(a, b)) > 2);
}
{
  // identical-ish groups => ~0 d
  const a = [0.6, 0.62, 0.58, 0.61];
  const b = [0.6, 0.59, 0.61, 0.6];
  ok('cohenD ~0 for similar groups', Math.abs(cohenD(a, b)) < 0.5);
}

// --- welchT ---
{
  const a = [0.8, 0.82, 0.78, 0.81, 0.79, 0.80, 0.83, 0.77];
  const b = [0.5, 0.52, 0.48, 0.51, 0.49, 0.50, 0.53, 0.47];
  const { p } = welchT(a, b);
  ok('welchT tiny p for separated groups', p < 0.001);
}
{
  const a = [0.6, 0.62, 0.58, 0.61, 0.59, 0.60];
  const b = [0.61, 0.59, 0.6, 0.62, 0.58, 0.6];
  const { p } = welchT(a, b);
  ok('welchT large p for similar groups', p > 0.2);
}

// --- compareBuckets: the honesty gates ---

// GATE 1: too few sessions per bucket => null (never report)
{
  const r = compareBuckets(
    { label: 'rested', values: [0.9, 0.9, 0.9] },
    { label: 'tired', values: [0.5, 0.5, 0.5] },
    BALANCED
  );
  ok('GATE min-per-bucket: 3 each => null', r === null);
}

// GATE 2: enough data + real effect => passes, correct high/low framing
{
  const rested = Array(10).fill(0).map((_, i) => 0.80 + (i % 3) * 0.01);
  const tired = Array(10).fill(0).map((_, i) => 0.60 + (i % 3) * 0.01);
  const r = compareBuckets({ label: 'rested', values: rested }, { label: 'tired', values: tired }, BALANCED);
  ok('real effect: not null', r !== null);
  ok('real effect: passes', r && r.passes === true);
  ok('real effect: high=rested', r && r.highLabel === 'rested');
  ok('real effect: low=tired', r && r.lowLabel === 'tired');
  ok('real effect: ~33% rel diff', r && approx(r.relativeDiffPct, 33, 3));
  ok('real effect: has confidence', r && (r.confidence === 'strong' || r.confidence === 'moderate'));
}

// GATE 3: enough data but tiny effect => does NOT pass (noise rejected)
{
  const a = Array(12).fill(0).map((_, i) => 0.70 + (i % 4) * 0.005);
  const b = Array(12).fill(0).map((_, i) => 0.69 + (i % 4) * 0.005);
  const r = compareBuckets({ label: 'a', values: a }, { label: 'b', values: b }, BALANCED);
  ok('tiny effect: returns result but does NOT pass', r !== null && r.passes === false);
}

// GATE 4: high variance washing out a modest mean diff => does NOT pass
{
  const a = [0.9, 0.3, 0.8, 0.2, 0.95, 0.1, 0.85, 0.25, 0.7, 0.4];
  const b = [0.8, 0.2, 0.7, 0.3, 0.6, 0.15, 0.9, 0.35, 0.55, 0.45];
  const r = compareBuckets({ label: 'a', values: a }, { label: 'b', values: b }, BALANCED);
  ok('noisy data: does NOT pass', r !== null && r.passes === false);
}

// confidence labelling: very strong, clean separation => "strong"
{
  const hi = Array(15).fill(0).map((_, i) => 0.85 + (i % 2) * 0.01);
  const lo = Array(15).fill(0).map((_, i) => 0.55 + (i % 2) * 0.01);
  const r = compareBuckets({ label: 'hi', values: hi }, { label: 'lo', values: lo }, BALANCED);
  ok('clean strong effect => strong confidence', r && r.confidence === 'strong');
}

console.log(`\nInsights stats tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('FAILURES'); process.exit(1); } else { console.log('ALL INSIGHTS STATS TESTS PASSED'); }
