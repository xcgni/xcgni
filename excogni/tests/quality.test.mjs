import { computeQualityFlags, TOO_FAST_MS } from '../src/lib/server/sessions/quality.ts';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.log('  FAIL:', name); } }
function has(arr, f) { return arr.includes(f); }

// clean attempt -> no flags
{
  const f = computeQualityFlags({ effectiveMs: 3000, clientElapsedMs: 3000, serverElapsedMs: 3050, expectedMedianMs: 4000, isFirstExposure: false });
  ok('clean attempt has no flags', f.length === 0);
}

// too fast
{
  const f = computeQualityFlags({ effectiveMs: 120, clientElapsedMs: 120, serverElapsedMs: 130, expectedMedianMs: 4000, isFirstExposure: false });
  ok('sub-250ms flagged too_fast', has(f, 'too_fast'));
}
{
  const f = computeQualityFlags({ effectiveMs: TOO_FAST_MS, clientElapsedMs: 250, serverElapsedMs: 260, expectedMedianMs: 4000, isFirstExposure: false });
  ok('exactly floor not flagged', !has(f, 'too_fast'));
}

// too slow (absolute)
{
  const f = computeQualityFlags({ effectiveMs: 130000, clientElapsedMs: 130000, serverElapsedMs: 130000, expectedMedianMs: 4000, isFirstExposure: false });
  ok('over 2 min flagged too_slow', has(f, 'too_slow'));
}
// too slow (relative to expected median)
{
  const f = computeQualityFlags({ effectiveMs: 60000, clientElapsedMs: 60000, serverElapsedMs: 60000, expectedMedianMs: 3000, isFirstExposure: false });
  ok('15x expected flagged too_slow', has(f, 'too_slow'));
}
{
  const f = computeQualityFlags({ effectiveMs: 20000, clientElapsedMs: 20000, serverElapsedMs: 20000, expectedMedianMs: 3000, isFirstExposure: false });
  ok('within window not too_slow', !has(f, 'too_slow'));
}

// first exposure
{
  const f = computeQualityFlags({ effectiveMs: 3000, clientElapsedMs: 3000, serverElapsedMs: 3000, expectedMedianMs: 4000, isFirstExposure: true });
  ok('first exposure flagged', has(f, 'first_exposure'));
}

// client clock disagreement
{
  const f = computeQualityFlags({ effectiveMs: 3000, clientElapsedMs: 1000, serverElapsedMs: 9000, expectedMedianMs: 4000, isFirstExposure: false });
  ok('client/server clock disagreement flagged', has(f, 'client_clock'));
}
{
  const f = computeQualityFlags({ effectiveMs: 3000, clientElapsedMs: 3000, serverElapsedMs: 3200, expectedMedianMs: 4000, isFirstExposure: false });
  ok('small clock diff not flagged', !has(f, 'client_clock'));
}

// multiple flags can co-occur
{
  const f = computeQualityFlags({ effectiveMs: 100, clientElapsedMs: 100, serverElapsedMs: 9000, expectedMedianMs: 4000, isFirstExposure: true });
  ok('multiple flags co-occur', has(f, 'too_fast') && has(f, 'first_exposure') && has(f, 'client_clock'));
}

console.log(`\nQuality-flag tests: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log('FAILURES'); process.exit(1); } else { console.log('ALL QUALITY-FLAG TESTS PASSED'); }
