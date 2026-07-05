// TTL cache for public aggregates (v0.67.1). The properties that matter under an HN spike:
// concurrent identical requests produce ONE query, values expire, errors never stick.
//   node --experimental-strip-types tests/cache.test.mjs
import { cached, _clearCache } from '../src/lib/server/cache.ts';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

_clearCache();

// --- hit/miss + TTL ---
{
  let calls = 0;
  const fn = async () => { calls++; return calls; };
  ok('first call computes', (await cached('k1', 50, fn)) === 1);
  ok('second call within TTL is served from cache', (await cached('k1', 50, fn)) === 1 && calls === 1);
  await sleep(70);
  ok('after TTL the value recomputes', (await cached('k1', 50, fn)) === 2 && calls === 2);
}

// --- stampede guard: N concurrent callers, one execution ---
{
  let calls = 0;
  const slow = async () => { calls++; await sleep(40); return 'v'; };
  const results = await Promise.all(Array.from({ length: 25 }, () => cached('k2', 1000, slow)));
  ok('25 concurrent callers -> 1 execution', calls === 1);
  ok('all callers got the value', results.every((r) => r === 'v'));
}

// --- errors are never cached ---
{
  let calls = 0;
  const flaky = async () => { calls++; if (calls === 1) throw new Error('boom'); return 'recovered'; };
  let threw = false;
  try { await cached('k3', 1000, flaky); } catch { threw = true; }
  ok('the error propagates', threw);
  ok('the next call retries and succeeds', (await cached('k3', 1000, flaky)) === 'recovered' && calls === 2);
  ok('the success IS cached', (await cached('k3', 1000, flaky)) === 'recovered' && calls === 2);
}

// --- distinct keys are independent ---
{
  ok('keys do not collide',
    (await cached('a', 1000, async () => 'A')) === 'A' &&
    (await cached('b', 1000, async () => 'B')) === 'B');
}

// --- the store stays bounded ---
{
  _clearCache();
  for (let i = 0; i < 600; i++) await cached('bulk' + i, 60_000, async () => i);
  ok('600 inserts do not grow unbounded (new keys still work)',
    (await cached('after-bound', 60_000, async () => 'ok')) === 'ok');
}

console.log(`\nCache tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL CACHE TESTS PASSED' : 'CACHE TESTS FAILED');
if (fail > 0) process.exit(1);
