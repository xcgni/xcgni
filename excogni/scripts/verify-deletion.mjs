// Verifies the account-deletion cascade end to end against the REAL database schema:
// creates a throwaway user, plants one row in every user-referencing table, deletes the user,
// and asserts zero orphans remain. With GDPR erasure stated as a public claim, this
// must be demonstrably true, not assumed.
//
// Run on the server (reads DATABASE_URL like the app):
//   docker compose exec app node scripts/verify-deletion.mjs
// Safe: uses its own throwaway user; touches no real data. Exit 0 = PASS, 1 = FAIL.

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://excogni:excogni@db:5432/excogni');

// every table with a user_id foreign key (keep in sync with schema.ts; the check below also
// discovers any user_id column we forgot, so drift is caught rather than silently skipped)
const KNOWN = [
  'auth_sessions', 'practice_sessions', 'attempts', 'user_category_state', 'user_card_state',
  'user_settings', 'user_attributes', 'user_rt_calibration', 'session_context', 'day_note', 'feedback'
];

async function main() {
  let failed = false;

  // discover every table that actually has a user_id column, so schema drift can't hide orphans
  const discovered = await sql`
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'user_id' AND table_schema = 'public'
  `;
  const tables = [...new Set(discovered.map((r) => r.table_name))];
  const unknown = tables.filter((t) => !KNOWN.includes(t));
  if (unknown.length) console.log(`note: user_id tables not in KNOWN list (still checked): ${unknown.join(', ')}`);

  // 1) throwaway user
  const [u] = await sql`
    INSERT INTO users (is_anonymous, is_test) VALUES (true, true) RETURNING id
  `;
  const uid = u.id;
  console.log(`created throwaway user ${uid}`);

  // 2) plant a row in each table (best effort per table; FK-dependent rows use real parents)
  const planted = [];
  async function plant(name, fn) {
    try { await fn(); planted.push(name); }
    catch (e) { console.log(`  could not plant ${name}: ${e.message.split('\n')[0]} (will still check orphans)`); }
  }
  await plant('auth_sessions', () => sql`INSERT INTO auth_sessions (user_id, token, expires_at) VALUES (${uid}, 'verify-cascade-' || gen_random_uuid(), now() + interval '1 minute')`);
  let sessionId = null;
  await plant('practice_sessions', async () => {
    const [s] = await sql`INSERT INTO practice_sessions (user_id) VALUES (${uid}) RETURNING id`;
    sessionId = s.id;
  });
  await plant('attempts', async () => {
    if (!sessionId) throw new Error('no session');
    const [c] = await sql`SELECT id, category_slug FROM challenges WHERE active LIMIT 1`;
    if (!c) throw new Error('no challenge to reference');
    await sql`INSERT INTO attempts (session_id, user_id, challenge_id, category_slug, level) VALUES (${sessionId}, ${uid}, ${c.id}, ${c.category_slug}, 1)`;
  });
  await plant('user_category_state', () => sql`INSERT INTO user_category_state (user_id, category_slug, current_level, stable_level, rating) VALUES (${uid}, 'working_memory', 1, 1, 700)`);
  await plant('user_card_state', async () => {
    const [c] = await sql`SELECT id FROM retention_cards WHERE active LIMIT 1`;
    if (!c) throw new Error('no retention card');
    await sql`INSERT INTO user_card_state (user_id, card_id, ease, interval_days, reps, lapses, due_at) VALUES (${uid}, ${c.id}, 2.5, 1, 0, 0, now())`;
  });
  await plant('user_settings', () => sql`INSERT INTO user_settings (user_id) VALUES (${uid})`);
  await plant('user_attributes', () => sql`INSERT INTO user_attributes (user_id) VALUES (${uid})`);
  await plant('user_rt_calibration', () => sql`INSERT INTO user_rt_calibration (user_id, floor_ms, uncertainty_ms, samples) VALUES (${uid}, 180, 20, 5)`);
  await plant('session_context', async () => {
    if (!sessionId) throw new Error('no session');
    await sql`INSERT INTO session_context (session_id, user_id) VALUES (${sessionId}, ${uid})`;
  });
  await plant('day_note', () => sql`INSERT INTO day_note (user_id, local_date, note) VALUES (${uid}, '2026-01-01', 'verify')`);
  await plant('feedback', () => sql`INSERT INTO feedback (user_id, kind, message) VALUES (${uid}, 'other', 'verify-cascade')`);
  console.log(`planted rows in: ${planted.join(', ')}`);

  // 3) delete the user (the actual erasure path)
  try {
    await sql`DELETE FROM users WHERE id = ${uid}`;
    console.log('user deleted');
  } catch (e) {
    console.error(`FAIL: user deletion itself was BLOCKED by a constraint: ${e.message.split('\n')[0]}`);
    console.error('      (a user-referencing FK lacks ON DELETE CASCADE)');
    failed = true;
  }

  // 4) orphan check across every discovered user_id table
  for (const t of tables) {
    const rows = await sql.unsafe(`SELECT count(*)::int AS n FROM ${t} WHERE user_id = '${uid}'`);
    const n = rows[0]?.n ?? 0;
    if (n > 0) { console.error(`FAIL: ${t} has ${n} orphaned row(s)`); failed = true; }
    else console.log(`  ok: ${t} clean`);
  }

  // cleanup safety: if deletion was blocked, remove the throwaway data manually
  if (failed) {
    for (const t of tables) await sql.unsafe(`DELETE FROM ${t} WHERE user_id = '${uid}'`).catch(() => {});
    await sql`DELETE FROM users WHERE id = ${uid}`.catch(() => {});
  }

  // Artifact hygiene: feedback.user_id is SET NULL by design (feedback content outlives the
  // account, identity link severed) - so the planted 'verify-cascade' message passes the per-user
  // check yet remains as an orphan, accumulating in the admin feedback list on every run.
  // Remove our own artifacts by content, never anyone's real feedback.
  const cleaned = await sql`DELETE FROM feedback WHERE message = 'verify-cascade' AND user_id IS NULL RETURNING 1`;
  if (cleaned.length) console.log(`  hygiene: removed ${cleaned.length} verify-cascade artifact(s) (feedback is SET NULL by design)`);

  console.log(failed ? '\nRESULT: FAIL - cascade incomplete, see above' : '\nRESULT: PASS - deletion cascade verified, no orphans');
  await sql.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error('script error:', e); await sql.end(); process.exit(1); });
