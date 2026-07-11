import { db, pg } from '$lib/server/db';
import { challenges, categories } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export interface ServedChallenge {
  id: string;
  categorySlug: string;
  challengeType: string;
  level: number;
  rendererType: string;
  promptData: unknown;
  scoringConfig: { expectedMedianMs: number };
  // the scoring mode string ONLY (for the transparency chip) - never the answer data itself
  scoringMode: string | null;
  version: number;
}

export async function implementedCategories(): Promise<{ slug: string; name: string }[]> {
  return db
    .select({ slug: categories.slug, name: categories.name })
    .from(categories)
    .where(and(eq(categories.implemented, true), eq(categories.active, true)));
}

export async function levelBounds(categorySlug: string): Promise<{ min: number; max: number }> {
  const rows = await pg`
    SELECT min(level)::int AS min, max(level)::int AS max
    FROM challenges WHERE category_slug = ${categorySlug} AND active AND lang = 'en'
  `;
  return { min: rows[0]?.min ?? 1, max: rows[0]?.max ?? 1 };
}

/**
 * Picks a random active challenge at (or nearest to) the requested level,
 * avoiding the user's most recently served challenges so short sessions
 * don't repeat. Falls back to allowing repeats if the level pool is small.
 */
export async function pickChallenge(
  categorySlug: string,
  level: number,
  userId: string
): Promise<ServedChallenge | null> {
  // Exclude the user's recently-served challenges IN THIS CATEGORY (not globally -
  // mixed practice interleaves categories, so a global window barely excludes any
  // single category's items and causes repeats when the level holds steady).
  // Window scales with how many items exist at this level so small banks still rotate.
  const levelCount = await pg`
    SELECT count(*)::int AS n FROM challenges
    WHERE category_slug = ${categorySlug} AND active AND lang = 'en' AND level = ${level}
  `;
  const poolN = levelCount[0]?.n ?? 0;
  // avoid up to ~70% of the level's items, capped, so there's always something fresh
  const avoidN = Math.max(5, Math.min(40, Math.floor(poolN * 0.7)));

  const fresh = await pg`
    SELECT c.id, c.category_slug, c.challenge_type, c.level, c.renderer_type,
           c.prompt_data, c.scoring_config, c.answer_data, c.version
    FROM challenges c
    WHERE c.category_slug = ${categorySlug} AND c.active AND c.lang = 'en' AND c.level = ${level}
      AND c.id NOT IN (
        SELECT a.challenge_id FROM attempts a
        WHERE a.user_id = ${userId} AND a.category_slug = ${categorySlug}
        ORDER BY a.served_at DESC LIMIT ${avoidN}
      )
    ORDER BY random() LIMIT 1
  `;
  let row = fresh[0];

  if (!row) {
    // allow repeats at this level
    const any = await pg`
      SELECT c.id, c.category_slug, c.challenge_type, c.level, c.renderer_type,
             c.prompt_data, c.scoring_config, c.answer_data, c.version
      FROM challenges c
      WHERE c.category_slug = ${categorySlug} AND c.active AND c.lang = 'en' AND c.level = ${level}
      ORDER BY random() LIMIT 1
    `;
    row = any[0];
  }

  if (!row) {
    // no challenges at this exact level: take the nearest populated level
    const nearest = await pg`
      SELECT c.id, c.category_slug, c.challenge_type, c.level, c.renderer_type,
             c.prompt_data, c.scoring_config, c.answer_data, c.version
      FROM challenges c
      WHERE c.category_slug = ${categorySlug} AND c.active AND c.lang = 'en'
      ORDER BY abs(c.level - ${level}), random() LIMIT 1
    `;
    row = nearest[0];
  }

  if (!row) return null;
  return {
    id: row.id,
    categorySlug: row.category_slug,
    challengeType: row.challenge_type,
    level: row.level,
    rendererType: row.renderer_type,
    promptData: row.prompt_data,
    scoringConfig: row.scoring_config,
    scoringMode:
      (row.answer_data as { scoringMode?: string } | null)?.scoringMode ??
      (row.scoring_config as { scoringMode?: string } | null)?.scoringMode ??
      null,
    version: row.version ?? 1
  };
}

/** Answer validation against the stored answer_data (never sent to the client). */
export { validateAnswer } from './validate';

/**
 * Mixed-practice rotation: among the enabled+implemented categories, choose
 * the one with the fewest attempts in this session (round-robin in effect).
 */
export async function pickMixedCategory(
  sessionId: string,
  enabledSlugs: string[],
  userId?: string
): Promise<string | null> {
  const implemented = await implementedCategories();
  // Only categories that actually have static challenges can appear in the mixed
  // run. Retention and Reaction Time have their own dedicated screens and no
  // challenge bank, so they must never be picked here.
  const withChallenges = await pg`
    SELECT DISTINCT category_slug FROM challenges WHERE active
  `;
  const hasBank = new Set(withChallenges.map((r: { category_slug: string }) => r.category_slug));
  const pool = implemented
    .map((c) => c.slug)
    .filter((s) => hasBank.has(s))
    .filter((s) => enabledSlugs.length === 0 || enabledSlugs.includes(s));
  if (pool.length === 0) {
    // fall back to any category that has a bank, ignoring the enabled filter
    const anyBank = implemented.map((c) => c.slug).filter((s) => hasBank.has(s));
    return anyBank[0] ?? null;
  }

  // PRIORITY 1 - fast to a full profile: front-load categories the user hasn't yet calibrated
  // (lifetime attempts < CALIBRATE_ATTEMPTS). Until every enabled category is measured, we keep
  // serving the least-measured uncalibrated one, so "profile complete" is reached as directly as
  // possible instead of left to chance. Once all are calibrated, we drop to normal session balancing.
  const CALIBRATE_ATTEMPTS = 10;
  if (userId) {
    const lifetime = await pg`
      SELECT category_slug, attempts_count AS n
      FROM user_category_state
      WHERE user_id = ${userId}
    `;
    const lifeByCat = new Map(
      lifetime.map((r: { category_slug: string; n: number }) => [r.category_slug, r.n])
    );
    const uncalibrated = pool.filter((s) => (lifeByCat.get(s) ?? 0) < CALIBRATE_ATTEMPTS);
    if (uncalibrated.length > 0) {
      // serve the least-measured uncalibrated category first (ties broken by fewest this session,
      // so a single session still feels varied rather than hammering one category 10 times in a row)
      const sessionCounts = await pg`
        SELECT category_slug, count(*)::int AS n
        FROM attempts WHERE session_id = ${sessionId}
        GROUP BY category_slug
      `;
      const sessByCat = new Map(
        sessionCounts.map((r: { category_slug: string; n: number }) => [r.category_slug, r.n])
      );
      uncalibrated.sort((a, b) => {
        const la = (lifeByCat.get(a) ?? 0), lb = (lifeByCat.get(b) ?? 0);
        if (la !== lb) return la - lb;
        return (sessByCat.get(a) ?? 0) - (sessByCat.get(b) ?? 0);
      });
      return uncalibrated[0];
    }
  }

  // PRIORITY 2 - everything calibrated: weighted pick instead of plain round-robin.
  // Three gentle thumbs on the scale (a mix should still feel mixed, so caps are modest):
  //  - weakness: categories rated below the user's own average get up to ~2x frequency -
  //    growth lives where the rating is lowest, and the mix should quietly lean there;
  //  - "show less often": user-reduced categories at ~0.35x;
  //  - session balance: each already-served category decays, keeping variety within a session.
  const counts = await pg`
    SELECT category_slug, count(*)::int AS n
    FROM attempts WHERE session_id = ${sessionId}
    GROUP BY category_slug
  `;
  const byCat = new Map(counts.map((r: { category_slug: string; n: number }) => [r.category_slug, r.n]));

  let ratingByCat = new Map<string, number>();
  let reduced = new Set<string>();
  if (userId) {
    const rows = await pg`
      SELECT category_slug, rating FROM user_category_state
      WHERE user_id = ${userId} AND attempts_count >= 10
    `;
    ratingByCat = new Map(rows.map((r: { category_slug: string; rating: number }) => [r.category_slug, Number(r.rating)]));
    const red = await pg`SELECT reduced_categories FROM user_settings WHERE user_id = ${userId}`;
    reduced = new Set<string>(red[0]?.reduced_categories ?? []);
  }
  const rated = [...ratingByCat.values()];
  const userAvg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

  const weights = pool.map((slug) => {
    let w = 1.0;
    if (userAvg != null && ratingByCat.has(slug)) {
      const deficit = userAvg - (ratingByCat.get(slug) as number);
      w *= 1 + Math.min(Math.max(deficit / 200, 0), 1); // up to 2x for >=200 below average
    }
    if (reduced.has(slug)) w *= 0.35;
    w /= 1 + (byCat.get(slug) ?? 0); // session-balance decay
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pool[0];
  let roll = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
