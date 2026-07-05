// Generates a simulated reference population so every radar axis has blue population points and the
// distributions aren't empty at launch. CRITICAL QUARANTINE: every row is tagged is_simulated=true.
// Population stats only include simulated users when ENABLE_SIMULATED_USERS=true; flip that off (in
// admin/toggles) once real users exist and the entire simulated population vanishes from every stat
// with no effect on real data. Simulated users can also be deleted wholesale in one query.
//
// Run: node scripts/gen-mock-data.mjs   (expects DATABASE_URL; idempotent - clears prior sim users first)
//
// This is intentionally a STANDALONE script (not auto-run by seed) so mock data is a deliberate act.

import postgres from 'postgres';

const URL = process.env.DATABASE_URL;
if (!URL) { console.error('DATABASE_URL required'); process.exit(1); }
const sql = postgres(URL);

const N_USERS = Number(process.env.MOCK_USERS || 200);

// realistic-ish rating distribution: centered ~1150, SD ~180, clamped to the ladder range.
function gaussian(mean, sd) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

async function main() {
  // categories to populate (all implemented + active)
  const cats = await sql`SELECT slug FROM categories WHERE implemented AND active`;
  const slugs = cats.map((c) => c.slug);
  if (slugs.length === 0) { console.error('no categories - run seed first'); process.exit(1); }

  // wipe any prior simulated users (clean idempotent regen; cascades to their attributes/state)
  const del = await sql`DELETE FROM users WHERE is_simulated = true RETURNING id`;
  console.log(`cleared ${del.length} prior simulated users`);

  let made = 0;
  for (let i = 0; i < N_USERS; i++) {
    // each sim user has a baseline ability; per-category rating = baseline + category noise.
    // Baseline mean is set deliberately modest (≈930) rather than at the ladder midpoint: the
    // simulated reference exists to populate the comparison UI before real data, and during that
    // bootstrap phase it's better for early real users (the "brave pioneers") to land at or above
    // the simulated median than below it - a discouraging first impression on synthetic data helps
    // no one. This is clearly labelled as simulated/preview everywhere it shows, and it's replaced by
    // real population data as users accumulate. ~20% lower than a midpoint-centred population.
    const baseline = gaussian(930, 160);

    const [u] = await sql`
      INSERT INTO users (email, is_anonymous, is_test, is_simulated, created_at)
      VALUES (${`sim_${i}@simulated.local`}, false, false, true,
              now() - (random() * interval '120 days'))
      RETURNING id
    `;
    // attributes: consented so they count in population stats. Demographic fields are left NULL -
    // simulated users have no real demographics, and inventing them (e.g. a fake country) would show
    // up as broken/misleading in breakdowns. Age/education are coarse buckets used only to demo the
    // breakdown UI; country/language/handedness stay null so they read as "unknown", not fake data.
    const ageBands = ['18-24', '25-34', '35-44', '45-54', '55+'];
    const eduBands = ['secondary', 'undergraduate', 'graduate', 'other'];
    await sql`
      INSERT INTO user_attributes (user_id, consented_stats, consent_at, consent_version, age_band, education)
      VALUES (${u.id}, true, now(), 1,
              ${ageBands[Math.floor(Math.random() * ageBands.length)]},
              ${eduBands[Math.floor(Math.random() * eduBands.length)]})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // per-category state across ALL categories, so every domain has population data
    for (const slug of slugs) {
      const rating = Math.round(clamp(baseline + gaussian(0, 90), 650, 1850));
      const attempts = 12 + Math.floor(Math.random() * 80); // past the 10-attempt calibration gate
      const correct = Math.floor(attempts * (0.45 + Math.random() * 0.4));
      const level = clamp(Math.round((rating - 600) / 110), 1, 14);
      await sql`
        INSERT INTO user_category_state
          (user_id, category_slug, current_level, stable_level, rating, attempts_count, correct_count,
           peak_rating, peak_rating_at, max_level, max_level_at, updated_at)
        VALUES (${u.id}, ${slug}, ${level}, ${level}, ${rating}, ${attempts}, ${correct},
                ${rating}, now(), ${level}, now(), now())
        ON CONFLICT (user_id, category_slug) DO NOTHING
      `;
    }
    made++;
    if (made % 50 === 0) console.log(`  ${made}/${N_USERS}`);
  }

  console.log(`done: ${made} simulated users across ${slugs.length} categories.`);
  console.log('Population stats include them only while ENABLE_SIMULATED_USERS=true.');
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
