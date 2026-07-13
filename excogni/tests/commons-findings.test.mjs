// Commons findings core (v1.6.0): population gates. Pure vectors.
//   node --experimental-strip-types tests/commons-findings.test.mjs
import { gatePopulationBands, gatePopulationLearning } from '../src/lib/server/insights/commons-core.ts';

let pass = 0, fail = 0;
function ok(name, cond, detail = '') { if (cond) pass++; else { fail++; console.log('  FAIL:', name, detail); } }

// bands: withheld below floor
{
  const f = gatePopulationBands('x', 'X', 'time-of-day',
    [{ band: 'morning', nUsers: 30, nAttempts: 900, mean: 0.8, sd: 0.2 }], 50);
  ok('withheld below floor', f.status === 'withheld' && /Withheld/.test(f.sentence));
  ok('withheld names the floor', f.sentence.includes('50'));
}
// bands: published with real effect
{
  const f = gatePopulationBands('x', 'X', 'time-of-day', [
    { band: 'morning', nUsers: 120, nAttempts: 4000, mean: 0.80, sd: 0.18 },
    { band: 'evening', nUsers: 90, nAttempts: 2500, mean: 0.72, sd: 0.20 }
  ], 50);
  ok('published with effect', f.status === 'published' && /morning/.test(f.sentence), JSON.stringify(f));
  ok('detail carries users and attempts', /120 users/.test(f.detail) && /d=/.test(f.detail));
  ok('nUsers summed', f.nUsers === 210);
}
// bands: null result published
{
  const f = gatePopulationBands('x', 'X', 'session-position', [
    { band: 'start', nUsers: 100, nAttempts: 3000, mean: 0.75, sd: 0.2 },
    { band: 'late', nUsers: 100, nAttempts: 3000, mean: 0.748, sd: 0.2 }
  ], 50);
  ok('null published', f.status === 'null' && /indistinguishable/.test(f.sentence));
}
// learning: withheld / published / null
{
  ok('learning withheld', gatePopulationLearning({ nUsers: 20, medianGain: 0.1, q1: 0, q3: 0.2 }, 50).status === 'withheld');
  const p = gatePopulationLearning({ nUsers: 200, medianGain: 0.14, q1: 0.05, q3: 0.25 }, 50);
  ok('learning published', p.status === 'published' && /\+14%/.test(p.sentence), p.sentence);
  ok('survivorship named', /Survivors|survivor/i.test(p.detail));
  ok('learning null', gatePopulationLearning({ nUsers: 200, medianGain: 0.01, q1: -0.05, q3: 0.06 }, 50).status === 'null');
}

console.log(`\nCommons-findings tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL COMMONS-FINDINGS TESTS PASSED' : 'COMMONS-FINDINGS TESTS FAILED');
if (fail > 0) process.exit(1);
