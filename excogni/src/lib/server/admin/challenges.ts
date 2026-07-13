import { pg } from '$lib/server/db';

// The renderer types the practice page knows how to draw. Adding a challenge with an unknown renderer
// would serve a blank card, so the manager constrains new challenges to these.
export const RENDERER_TYPES = [
  'numeric_text_input',
  'multiple_choice_text',
  'multiple_choice_svg',
  'two_choice',
  'memory_recall',
  'fluency_list',
  'planning_sequence'
];

export interface ChallengeRow {
  id: string;
  categorySlug: string;
  challengeType: string;
  level: number;
  rendererType: string;
  promptData: unknown;
  answerData: unknown;
  scoringConfig: unknown;
  active: boolean;
  tier: string;
  bankKey: string | null;
  version: number;
  observedMedianMs: number | null;
}

export interface CategorySummary {
  slug: string;
  name: string;
  total: number;
  active: number;
  levels: number;
}

// Per-category counts for the manager's overview (active vs total, level span).
export async function challengeOverview(): Promise<CategorySummary[]> {
  const rows = await pg`
    SELECT c.slug, c.name,
           count(ch.id)::int AS total,
           count(ch.id) FILTER (WHERE ch.active)::int AS active,
           count(DISTINCT ch.level)::int AS levels
    FROM categories c
    LEFT JOIN challenges ch ON ch.category_slug = c.slug
    WHERE c.implemented AND c.active
    GROUP BY c.slug, c.name
    ORDER BY c.sort, c.name
  `;
  return rows as CategorySummary[];
}

// List challenges for a category, optionally filtered by level / active state. Paginated.
export async function listChallenges(opts: {
  category: string;
  level?: number | null;
  activeOnly?: boolean;
  search?: string | null;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ChallengeRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const level = opts.level ?? null;
  const hasLevel = level != null;
  const activeOnly = opts.activeOnly ?? false;
  const search = (opts.search ?? '').trim();
  const hasSearch = search.length > 0;
  const like = '%' + search + '%';

  const rows = await pg`
    SELECT id, category_slug AS "categorySlug", challenge_type AS "challengeType", level,
           renderer_type AS "rendererType", prompt_data AS "promptData", answer_data AS "answerData",
           scoring_config AS "scoringConfig", active, tier, bank_key AS "bankKey", version,
           observed_median_ms AS "observedMedianMs"
    FROM challenges
    WHERE category_slug = ${opts.category}
      AND (${!hasLevel} OR level = ${hasLevel ? level : 0})
      AND (${!activeOnly} OR active = true)
      AND (${!hasSearch} OR bank_key ILIKE ${like} OR prompt_data::text ILIKE ${like})
    ORDER BY level, bank_key NULLS LAST, id
    LIMIT ${limit} OFFSET ${offset}
  `;
  const cnt = await pg`
    SELECT count(*)::int AS n FROM challenges
    WHERE category_slug = ${opts.category}
      AND (${!hasLevel} OR level = ${hasLevel ? level : 0})
      AND (${!activeOnly} OR active = true)
      AND (${!hasSearch} OR bank_key ILIKE ${like} OR prompt_data::text ILIKE ${like})
  `;
  return { rows: rows as ChallengeRow[], total: (cnt as { n: number }[])[0]?.n ?? 0 };
}

// Move a challenge between tiers. canonical = counts toward official scores; experimental = collects
// data but does not affect ratings (a proving ground for new paradigms).
export async function setChallengeTier(id: string, tier: 'canonical' | 'experimental'): Promise<void> {
  await pg`UPDATE challenges SET tier = ${tier}, updated_at = now() WHERE id = ${id}`;
}

// Toggle a single challenge active/inactive. Inactive challenges are never served.
export async function setChallengeActive(id: string, active: boolean): Promise<void> {
  await pg`
    UPDATE challenges
    SET active = ${active},
        retired_at = CASE WHEN ${active} THEN NULL ELSE now() END,
        updated_at = now()
    WHERE id = ${id}
  `;
}

// Bulk enable/disable an entire category (or a single level within it).
export async function setCategoryActive(category: string, active: boolean, level: number | null = null): Promise<number> {
  const hasLevel = level != null;
  const rows = await pg`
    UPDATE challenges
    SET active = ${active},
        retired_at = CASE WHEN ${active} THEN NULL ELSE now() END,
        updated_at = now()
    WHERE category_slug = ${category} AND (${!hasLevel} OR level = ${hasLevel ? level : 0})
    RETURNING id
  `;
  return (rows as unknown[]).length;
}

// Validate the JSON payloads before writing - malformed JSON would break serving/grading.
export function parseJsonFields(input: { promptData: string; answerData: string; scoringConfig: string }):
  { ok: true; promptData: unknown; answerData: unknown; scoringConfig: unknown } | { ok: false; error: string } {
  try {
    const promptData = JSON.parse(input.promptData);
    const answerData = JSON.parse(input.answerData);
    const scoringConfig = JSON.parse(input.scoringConfig);
    if (typeof promptData !== 'object' || promptData == null) return { ok: false, error: 'promptData must be a JSON object.' };
    if (typeof answerData !== 'object' || answerData == null) return { ok: false, error: 'answerData must be a JSON object.' };
    if (typeof scoringConfig !== 'object' || scoringConfig == null) return { ok: false, error: 'scoringConfig must be a JSON object.' };
    return { ok: true, promptData, answerData, scoringConfig };
  } catch (e) {
    return { ok: false, error: 'Invalid JSON: ' + (e as Error).message };
  }
}

// Edit an existing challenge's editable fields.
export async function updateChallenge(id: string, fields: {
  challengeType: string;
  level: number;
  rendererType: string;
  promptData: unknown;
  answerData: unknown;
  scoringConfig: unknown;
}): Promise<void> {
  await pg`
    UPDATE challenges SET
      challenge_type = ${fields.challengeType},
      level = ${fields.level},
      renderer_type = ${fields.rendererType},
      prompt_data = ${JSON.stringify(fields.promptData)}::jsonb,
      answer_data = ${JSON.stringify(fields.answerData)}::jsonb,
      scoring_config = ${JSON.stringify(fields.scoringConfig)}::jsonb,
      version = version + 1,
      updated_at = now()
    WHERE id = ${id}
  `;
}

// Manually add a new challenge to a category. bankKey is auto-suffixed 'manual' so it's traceable and
// won't collide with generated banks (which would be overwritten on re-seed).
export async function addChallenge(fields: {
  categorySlug: string;
  challengeType: string;
  level: number;
  rendererType: string;
  promptData: unknown;
  answerData: unknown;
  scoringConfig: unknown;
}): Promise<string> {
  const stamp = Date.now().toString(36);
  const bankKey = `manual-${fields.categorySlug}-L${fields.level}-${stamp}`;
  const rows = await pg`
    INSERT INTO challenges (category_slug, challenge_type, level, renderer_type, prompt_data, answer_data, scoring_config, bank_key, active)
    VALUES (
      ${fields.categorySlug}, ${fields.challengeType}, ${fields.level}, ${fields.rendererType},
      ${JSON.stringify(fields.promptData)}::jsonb, ${JSON.stringify(fields.answerData)}::jsonb,
      ${JSON.stringify(fields.scoringConfig)}::jsonb, ${bankKey}, true
    )
    RETURNING id
  `;
  return (rows as { id: string }[])[0].id;
}
