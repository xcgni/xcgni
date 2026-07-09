// Findings core (v1.5.0): gates, effect sizes, honest sentences. Pure module, direct vectors.
//   node --experimental-strip-types tests/findings.test.mjs
import { gateTimeOfDay, gateLearningCurve, gatePosition } from '../src/lib/server/insights/findings-core.ts';

let pass = 0, fail = 0;
function ok(name, cond, detail = '') { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail); } }

// --- time of day ---
{
  const f = gateTimeOfDay([{ band: 'morning', n: 10, mean: 0.8, sd: 0.2 }]);
  ok('tod: locked below n', f.unlocked === false && f.sentence.includes('Unlocks'));
}
{
  const f = gateTimeOfDay([
    { band: 'morning', n: 60, mean: 0.82, sd: 0.15 },
    { band: 'evening', n: 45, mean: 0.70, sd: 0.18 }
  ]);
  ok('tod: unlocks with real effect', f.unlocked === true && f.effect !== null && f.effect > 0.25, JSON.stringify(f));
  ok('tod: sentence names bands', f.sentence.includes('morning') && f.sentence.includes('evening'));
  ok('tod: detail carries n and d', f.detail.includes('n=60') && f.detail.includes('d='));
  ok('tod: no causal language', !/because|causes/i.test(f.sentence));
}
{
  const f = gateTimeOfDay([
    { band: 'morning', n: 60, mean: 0.75, sd: 0.2 },
    { band: 'evening', n: 60, mean: 0.74, sd: 0.2 }
  ]);
  ok('tod: tiny effect reports honest null', f.unlocked === true && f.effect === 0 && /indistinguishable/.test(f.sentence));
}

// --- learning curve ---
{
  const f = gateLearningCurve([{ category_slug: 'working_memory', n: 20, early_mean: 0.5, late_mean: 0.6 }]);
  ok('curve: locked below 40', f.unlocked === false && f.detail.includes('20/40'));
}
{
  const f = gateLearningCurve([{ category_slug: 'working_memory', n: 60, early_mean: 0.50, late_mean: 0.65 }]);
  ok('curve: unlocks and reports gain', f.unlocked === true && f.effect > 0.2, JSON.stringify(f));
  ok('curve: practice effect NAMED', /PRACTICE EFFECT/.test(f.detail));
  ok('curve: category prettified', f.sentence.includes('working memory'));
}
{
  const f = gateLearningCurve([{ category_slug: 'inhibition', n: 60, early_mean: 0.70, late_mean: 0.70 }]);
  ok('curve: plateau honestly reported', f.unlocked === true && f.effect === 0 && /plateau/i.test(f.sentence));
}

// --- session position ---
{
  const f = gatePosition([{ bucket: 'start', n: 10, mean: 0.7, sd: 0.2 }]);
  ok('pos: locked without both buckets', f.unlocked === false);
}
{
  const f = gatePosition([
    { bucket: 'start', n: 50, mean: 0.80, sd: 0.15 },
    { bucket: 'late', n: 40, mean: 0.68, sd: 0.18 }
  ]);
  ok('pos: fatigue-like dip detected', f.unlocked === true && f.effect < -0.25 && /dip/.test(f.sentence), JSON.stringify(f));
}
{
  const f = gatePosition([
    { bucket: 'start', n: 50, mean: 0.70, sd: 0.2 },
    { bucket: 'late', n: 50, mean: 0.71, sd: 0.2 }
  ]);
  ok('pos: steady is a finding too', f.unlocked === true && f.effect === 0 && /steady/i.test(f.sentence));
}

console.log(`\nFindings tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL FINDINGS TESTS PASSED' : 'FINDINGS TESTS FAILED');
if (fail > 0) process.exit(1);

// --- v1.8.0 (J5): context findings - sleep & caffeine gates ---
{
  const { gateSleep, gateCaffeine } = await import('../src/lib/server/insights/findings-core.ts');
  let p3 = 0, f3 = 0;
  const ok3 = (name, cond, detail = '') => { if (cond) p3++; else { f3++; console.log('  FAIL:', name, detail); } };

  ok3('sleep: locked with one band', gateSleep([{ band: 'rested (6.5h+)', n: 80, mean: 0.8, sd: 0.2 }]).unlocked === false);
  {
    const f = gateSleep([
      { band: 'rested (6.5h+)', n: 60, mean: 0.82, sd: 0.16 },
      { band: 'short-sleep (<6.5h)', n: 40, mean: 0.71, sd: 0.19 }
    ]);
    ok3('sleep: unlocks with effect', f.unlocked === true && f.effect > 0.25, JSON.stringify(f));
    ok3('sleep: sentence names both bands', /rested/.test(f.sentence) && /short-sleep/.test(f.sentence));
    ok3('sleep: caveat says association not cause', /association/i.test(f.detail) && /not cause/i.test(f.detail));
  }
  {
    const f = gateSleep([
      { band: 'rested (6.5h+)', n: 60, mean: 0.75, sd: 0.2 },
      { band: 'short-sleep (<6.5h)', n: 60, mean: 0.745, sd: 0.2 }
    ]);
    ok3('sleep: null result honest', f.unlocked === true && f.effect === 0 && /indistinguishable/.test(f.sentence));
  }
  {
    const f = gateCaffeine([
      { band: 'no-caffeine', n: 45, mean: 0.70, sd: 0.18 },
      { band: 'high-caffeine', n: 50, mean: 0.79, sd: 0.17 }
    ]);
    ok3('caffeine: unlocks and best band leads', f.unlocked === true && /high-caffeine days run/.test(f.sentence), f.sentence);
    ok3('caffeine: reverse-causation caveat present', /FOLLOW/.test(f.detail));
  }

  console.log(`Context-findings tests: ${p3} passed, ${f3} failed`);
  if (f3 > 0) { console.log('CONTEXT-FINDINGS TESTS FAILED'); process.exit(1); }
  console.log('ALL CONTEXT-FINDINGS TESTS PASSED');
}
