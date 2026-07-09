// Item statistics (v1.7.0) - classical test theory, published. Per challenge:
//   difficulty  - proportion correct (p-value, CTT sense)
//   discrimination - point-biserial: corr(item correctness, the user's mean accuracy in
//                    the item's category). Approximation note: the user mean INCLUDES the
//                    item itself; with many attempts per user the bias is small, and the
//                    approximation is stated on the page rather than hidden.
//   n, median response time
// Consented users only, simulated excluded outside preview. Items below the reporting
// threshold are WITHHELD as a count, never silently dropped. Cached hard: this is a
// population table, staleness is invisible and the query is not free.

import { pg } from '$lib/server/db';
import { cached } from '$lib/server/cache';

const TTL = 5 * 60_000;
export const ITEM_MIN_N = 30;

export interface ItemStat {
  bankKey: string;
  category: string;
  challengeType: string;
  level: number;
  n: number;
  difficulty: number;          // 0..1 proportion correct
  discrimination: number | null; // point-biserial approximation, null when degenerate
  medianMs: number | null;
}

export interface ItemStatistics {
  items: ItemStat[];
  withheld: number;            // items with data but below ITEM_MIN_N
  categories: string[];        // for the filter UI
  totalAttempts: number;
}

function consentJoin(preview: boolean) {
  return preview
    ? pg`JOIN users u ON u.id = a.user_id AND u.is_anonymous = false AND u.is_test = false
         JOIN user_attributes ua ON ua.user_id = u.id AND ua.consented_stats = true`
    : pg`JOIN users u ON u.id = a.user_id AND u.is_anonymous = false AND u.is_test = false AND u.is_simulated = false
         JOIN user_attributes ua ON ua.user_id = u.id AND ua.consented_stats = true`;
}

async function computeItemStatistics(preview: boolean, category: string | null): Promise<ItemStatistics> {
  const catFilter = category ? pg`AND ch.category_slug = ${category}` : pg``;

  const rows = await pg`
    WITH user_cat AS (
      SELECT a.user_id, a.category_slug, avg((a.correct)::int)::float AS user_mean
      FROM attempts a
      ${consentJoin(preview)}
      WHERE a.status = 'answered' AND a.correct IS NOT NULL
      GROUP BY a.user_id, a.category_slug
    ),
    per_item AS (
      SELECT ch.bank_key, ch.category_slug, ch.challenge_type, ch.level,
             count(*)::int AS n,
             avg((a.correct)::int)::float AS difficulty,
             corr((a.correct)::int, uc.user_mean)::float AS discrimination,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY a.effective_ms)::float AS median_ms
      FROM attempts a
      JOIN challenges ch ON ch.id = a.challenge_id
      JOIN user_cat uc ON uc.user_id = a.user_id AND uc.category_slug = a.category_slug
      ${consentJoin(preview)}
      WHERE a.status = 'answered' AND a.correct IS NOT NULL AND ch.bank_key IS NOT NULL
        ${catFilter}
      GROUP BY ch.bank_key, ch.category_slug, ch.challenge_type, ch.level
    )
    SELECT * FROM per_item ORDER BY category_slug, level, bank_key
  `;

  const all = rows as {
    bank_key: string; category_slug: string; challenge_type: string; level: number;
    n: number; difficulty: number; discrimination: number | null; median_ms: number | null;
  }[];

  const items: ItemStat[] = [];
  let withheld = 0;
  let totalAttempts = 0;
  for (const r of all) {
    totalAttempts += r.n;
    if (r.n < ITEM_MIN_N) { withheld++; continue; }
    items.push({
      bankKey: r.bank_key,
      category: r.category_slug,
      challengeType: r.challenge_type,
      level: r.level,
      n: r.n,
      difficulty: Math.round(r.difficulty * 100) / 100,
      discrimination: r.discrimination == null ? null : Math.round(r.discrimination * 100) / 100,
      medianMs: r.median_ms == null ? null : Math.round(r.median_ms)
    });
  }

  const cats = await pg`
    SELECT DISTINCT category_slug FROM challenges WHERE bank_key IS NOT NULL ORDER BY category_slug
  `;
  return {
    items, withheld, totalAttempts,
    categories: (cats as { category_slug: string }[]).map((c) => c.category_slug)
  };
}

export async function itemStatistics(preview: boolean, category: string | null) {
  return cached(`item-stats:${preview}:${category ?? 'all'}`, TTL, () => computeItemStatistics(preview, category));
}
