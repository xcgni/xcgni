// Module smoke (v1.3.1): imports every environment-free server module and INVOKES its
// cheap pure surfaces. Exists because a static scan cannot catch a call to a function
// that was never defined (the v1.1.1 maskForLog incident: the call site shipped, the
// definition did not, and the crash was runtime-only). Importing alone is not enough -
// the incident only fired on CALL, so this suite calls.
//   node --experimental-strip-types tests/module-smoke.test.mjs
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); } }
async function mustImport(name, path) {
  try { const m = await import(path); ok(`import ${name}`, true); return m; }
  catch (e) { ok(`import ${name} (${e.message})`, false); return null; }
}

// --- the log module: call EVERY exported helper with dummy data ---
{
  const mod = await mustImport('log', '../src/lib/server/log.ts');
  if (mod?.log) {
    let called = 0, threw = 0;
    for (const [k, fn] of Object.entries(mod.log)) {
      if (typeof fn !== 'function') continue;
      try {
        // arity-blind dummy invocation: strings satisfy every current signature
        fn('smoke@example.com', 'smoke', 'smoke');
        called++;
      } catch (e) {
        threw++;
        console.log(`  log.${k} threw:`, e.message);
      }
    }
    ok(`every log helper callable (${called} called)`, threw === 0 && called >= 5);
  }
}

// --- pure grading/scoring modules: import + a representative call each ---
{
  const m = await mustImport('planning graders', '../src/lib/server/sessions/planning.ts');
  if (m) {
    ok('gradePlan runs', m.gradePlan('*2', { start: 2, target: 4, allowed: ['*2'] }).correct === true);
    ok('gradeStepOrder runs', m.gradeStepOrder('AB', { correctOrder: 'AB' }).correct === true);
    ok('gradeGridPath runs', m.gradeGridPath('R', { rows: ['ST'] }).correct === true);
  }
}
{
  const m = await mustImport('email-index', '../src/lib/server/auth/email-index.ts');
  if (m) {
    ok('emailHint runs', typeof m.emailHint('someone@example.com') === 'string');
    ok('normalizeEmail runs', m.normalizeEmail('  A@B.com ') === 'a@b.com');
  }
}
{
  const m = await mustImport('totp', '../src/lib/server/admin/totp.ts');
  if (m) ok('verifyTotp runs (wrong code returns null/false)', !m.verifyTotp(Buffer.from('12345678901234567890'), '000000'));
}
{
  const m = await mustImport('cache', '../src/lib/server/cache.ts');
  if (m) {
    const v = await m.cached('smoke', 1000, async () => 42);
    ok('cache round-trips', v === 42);
    m._clearCache();
  }
}
{
  const m = await mustImport('answer validation', '../src/lib/server/challenges/validate.ts');
  if (m) ok('validateAnswer runs', m.validateAnswer({ correctAnswer: 5 }, '5') === true);
}

console.log(`\nModule smoke: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL MODULE-SMOKE TESTS PASSED' : 'MODULE-SMOKE TESTS FAILED');
if (fail > 0) process.exit(1);
