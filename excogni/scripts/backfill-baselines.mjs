// One-time backfill of user_category_baseline for users who calibrated BEFORE baselines existed.
// Definition matches the live capture hooks exactly:
//  - bank categories: the rating_after of the user's 10th answered attempt in that category
//    (precise: attempts are the ground truth).
//  - retention / reaction_time: these modules write no attempts rows, so the baseline is the
//    earliest rating_history entry for that category (an honest approximation of "first
//    calibrated rating"; flagged in attempts_count as -1 so it is distinguishable).
// Idempotent: ON CONFLICT DO NOTHING everywhere; safe to re-run.
//
// Run on the server: docker compose exec app node scripts/backfill-baselines.mjs

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL ?? 'postgres://excogni:excogni@db:5432/excogni');

async function main() {
  // bank categories: 10th answered attempt with a recorded rating_after
  const bank = await sql`
    INSERT INTO user_category_baseline (user_id, category_slug, rating, attempts_count, captured_at)
    SELECT user_id, category_slug, rating_after, 10, served_at
    FROM (
      SELECT user_id, category_slug, rating_after, served_at,
             row_number() OVER (PARTITION BY user_id, category_slug ORDER BY served_at) AS rn
      FROM attempts
      WHERE status = 'answered' AND rating_after IS NOT NULL
    ) t
    WHERE rn = 10
    ON CONFLICT (user_id, category_slug) DO NOTHING
    RETURNING 1
  `;
  console.log(`bank baselines inserted: ${bank.length}`);

  // retention + reaction: earliest rating_history entry (approximation, attempts_count = -1)
  const mod = await sql`
    INSERT INTO user_category_baseline (user_id, category_slug, rating, attempts_count, captured_at)
    SELECT DISTINCT ON (user_id, category_slug) user_id, category_slug, rating, -1, recorded_at
    FROM rating_history
    WHERE category_slug IN ('retention', 'reaction_time')
    ORDER BY user_id, category_slug, recorded_at ASC
    ON CONFLICT (user_id, category_slug) DO NOTHING
    RETURNING 1
  `;
  console.log(`module baselines inserted (approximated from earliest history): ${mod.length}`);

  const total = await sql`SELECT count(*)::int AS n FROM user_category_baseline`;
  console.log(`total baselines now: ${total[0].n}`);
  await sql.end();
}

main().catch(async (e) => { console.error('backfill error:', e); await sql.end(); process.exit(1); });
