// DB integration: the core measurement loop, end to end (v1.4.0).
// Exercises submitAttempt() against a REAL Postgres - the one path no unit test covers,
// and exactly where the v1.3.2 fluency-dedup bug lived. Requires DATABASE_URL (skips
// politely without it); CI provides a postgres service container. Run:
//   node --experimental-strip-types --import ./tests-db/register.mjs tests-db/attempt-flow.test.mjs
// Prereq: scripts/migrate.mjs has run. Seed is NOT required: this test plants every row it
// needs (including its own category) and removes them afterwards.
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL not set - integration test SKIPPED (this is fine locally).');
  process.exit(0);
}

const { pg } = await import('$lib/server/db');
const { submitAttempt } = await import('$lib/server/sessions/index');

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name, detail); }
}

const userId = randomUUID();
const sessionId = randomUUID();
const CAT = 'it_test_category';
const ids = { fluency: randomUUID(), numeric: randomUUID(), order: randomUUID(), grid: randomUUID() };
const bank = (k) => `it-${k}-${userId.slice(0, 8)}`;

async function plantChallenge(id, key, rendererType, promptData, answerData, scoringConfig) {
  await pg`
    INSERT INTO challenges (id, bank_key, category_slug, challenge_type, level, renderer_type, prompt_data, answer_data, scoring_config)
    VALUES (${id}, ${bank(key)}, ${CAT}, ${'integration_' + key}, 1, ${rendererType},
            ${JSON.stringify(promptData)}::jsonb, ${JSON.stringify(answerData)}::jsonb, ${JSON.stringify(scoringConfig)}::jsonb)
  `;
}

async function plantAttempt(challengeId) {
  const attemptId = randomUUID();
  await pg`
    INSERT INTO attempts (id, user_id, session_id, challenge_id, category_slug, level, status, served_at)
    VALUES (${attemptId}, ${userId}, ${sessionId}, ${challengeId}, ${CAT}, 1, 'pending', now())
  `;
  return attemptId;
}

try {
  // --- fixtures (own category so no seed dependency; FK on challenges requires it) ---
  await pg`
    INSERT INTO categories (slug, name, description, implemented, active, sort)
    VALUES (${CAT}, 'Integration test', 'transient', true, false, 999)
    ON CONFLICT (slug) DO NOTHING
  `;
  await pg`INSERT INTO users (id, is_anonymous) VALUES (${userId}, true)`;
  await pg`INSERT INTO practice_sessions (id, user_id, tz_offset_min) VALUES (${sessionId}, ${userId}, 0)`;

  const cfg = { expectedMedianMs: 5000 };
  await plantChallenge(ids.fluency, 'fluency', 'fluency_list',
    { instruction: 'Name languages', timeMs: 30000 },
    { scoringMode: 'fluency_count', acceptList: ['english', 'german', 'spanish', 'french'] }, cfg);
  await plantChallenge(ids.numeric, 'numeric', 'numeric_text_input',
    { instruction: 'What is 6 x 7?' },
    { correctAnswer: 42 }, cfg);
  await plantChallenge(ids.order, 'order', 'planning_sequence',
    { kind: 'step_order', instruction: 'Order the steps', steps: ['A. two', 'B. one'], hint: '' },
    { scoringMode: 'deliberate', correctOrder: 'BA' }, cfg);
  await plantChallenge(ids.grid, 'grid', 'planning_sequence',
    { kind: 'grid_path', instruction: 'S to T', rows: ['S·', '·T'], hint: '' },
    { scoringMode: 'deliberate', rows: ['S·', '·T'], optimalMoves: 2 }, cfg);

  // --- 1. fluency: the v1.3.2 screenshot scenario, end to end ---
  {
    const attemptId = await plantAttempt(ids.fluency);
    const r = await submitAttempt(userId, attemptId, JSON.stringify(['english', 'englisg', 'englsh', 'german']), 8000);
    ok('fluency submit returns a result', !('error' in r), JSON.stringify(r).slice(0, 160));
    if (!('error' in r)) {
      ok('typo-farming counts 2, not 4', r.fluencyValidCount === 2, `got ${r.fluencyValidCount}`);
      const dups = (r.fluencyWords ?? []).filter((x) => x.dup).length;
      ok('two words flagged as dup', dups === 2, `got ${dups}`);
      const row = await pg`SELECT status FROM attempts WHERE id = ${attemptId}`;
      ok('attempt persisted as answered', row[0]?.status === 'answered');
    }
  }

  // --- 2. numeric: correct and wrong ---
  {
    const a1 = await plantAttempt(ids.numeric);
    const r1 = await submitAttempt(userId, a1, '42', 3000);
    ok('numeric correct', !('error' in r1) && r1.correct === true, JSON.stringify(r1).slice(0, 120));
    const a2 = await plantAttempt(ids.numeric);
    const r2 = await submitAttempt(userId, a2, '41', 3000);
    ok('numeric wrong', !('error' in r2) && r2.correct === false);
  }

  // --- 3. planning kinds through the real dispatch ---
  {
    const a1 = await plantAttempt(ids.order);
    const r1 = await submitAttempt(userId, a1, 'b, a', 9000);
    ok('step_order correct via dispatch', !('error' in r1) && r1.correct === true, JSON.stringify(r1).slice(0, 120));
    const a2 = await plantAttempt(ids.grid);
    const r2 = await submitAttempt(userId, a2, 'R D', 9000);
    ok('grid_path correct via dispatch', !('error' in r2) && r2.correct === true);
    const a3 = await plantAttempt(ids.grid);
    const r3 = await submitAttempt(userId, a3, 'D D', 9000);
    ok('grid_path wall/oob rejected', !('error' in r3) && r3.correct === false);
  }

  // --- 4. double-submit guard ---
  {
    const a = await plantAttempt(ids.numeric);
    await submitAttempt(userId, a, '42', 1000);
    const again = await submitAttempt(userId, a, '42', 1000);
    ok('second submit refused', 'error' in again);
  }
} finally {
  await pg`DELETE FROM users WHERE id = ${userId}`.catch(() => {});
  await pg`DELETE FROM challenges WHERE id IN (${ids.fluency}, ${ids.numeric}, ${ids.order}, ${ids.grid})`.catch(() => {});
  await pg`DELETE FROM categories WHERE slug = ${CAT}`.catch(() => {});
  await pg.end({ timeout: 3 }).catch(() => {});
}

console.log(`\nAttempt-flow integration: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL ATTEMPT-FLOW TESTS PASSED' : 'ATTEMPT-FLOW TESTS FAILED');
process.exit(fail === 0 ? 0 : 1);
