import { scoringLabel } from '$lib/server/challenges/scoring-label';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureUser } from '$lib/server/auth';
import { db, pg } from '$lib/server/db';
import { attempts } from '$lib/server/db/schema';
import { ensureSession, getCategoryState, getEnabledCategories } from '$lib/server/sessions';
import { pickChallenge, pickMixedCategory, implementedCategories } from '$lib/server/challenges';
import { pickModuleHandoff } from '$lib/server/challenges/modules';
import { SCORING_MODEL_VERSION } from '$lib/server/rating';

/**
 * POST /api/practice/next  body: { category?: string }
 * Creates the anonymous user on first contact, opens/continues a session,
 * records a pending attempt (served_at = server clock) and returns the prompt.
 * Answer data never leaves the server.
 */
export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  const user = await ensureUser(cookies);
  const body = (await request.json().catch(() => ({}))) as {
    category?: string; tz?: string; tzOffsetMin?: number; pulse?: boolean;
  };
  const tz = typeof body.tz === 'string' ? body.tz.slice(0, 64) : null;
  const tzOffsetMin = typeof body.tzOffsetMin === 'number' && Number.isFinite(body.tzOffsetMin)
    ? Math.round(body.tzOffsetMin) : null;
  const sessionId = await ensureSession(user.id, tz, tzOffsetMin, body.pulse === true ? 'pulse' : 'practice');

  let categorySlug = body.category ?? null;
  const implemented = await implementedCategories();
  // Only bank-backed categories are valid for the timed run. Retention and
  // Reaction Time have their own screens; if requested here, ignore and fall
  // back to mixed practice rather than erroring.
  const withChallenges = await pg`SELECT DISTINCT category_slug FROM challenges WHERE active`;
  const bankSlugs = new Set(withChallenges.map((r: { category_slug: string }) => r.category_slug));
  const validSlugs = implemented.map((c) => c.slug).filter((s) => bankSlugs.has(s));

  if (categorySlug && !validSlugs.includes(categorySlug)) {
    categorySlug = null; // bankless or unknown -> mixed practice
  }
  if (!categorySlug) {
    let enabled = await getEnabledCategories(user.id);
    // Session-scoped skips: "not this, not today". Subtract them for this session's remainder;
    // if the user skipped everything, fall back to the full enabled set rather than stalling.
    const skiprow = await pg`SELECT skipped_categories FROM practice_sessions WHERE id = ${sessionId}`;
    const skipped: string[] = skiprow[0]?.skipped_categories ?? [];
    if (skipped.length) {
      const effective = enabled.filter((s) => !skipped.includes(s));
      if (effective.length) enabled = effective;
    }
    // Before picking a bank challenge, see if this mixed step should hand off to a dedicated
    // module (Retention / Reaction), so those domains are genuinely part of the mix instead of
    // sitting empty on the radar. Only in mixed mode (no explicit category requested).
    if (!body.category) {
      const handoff = await pickModuleHandoff(user.id, sessionId, enabled);
      if (handoff) {
        // Record the hand-off time so we don't immediately bounce back into a module on return.
        await pg`UPDATE practice_sessions SET last_module_at = now(), module_handoffs = module_handoffs + 1, modules_used = array_append(modules_used, ${handoff.module}) WHERE id = ${sessionId}`;
        return json({ handoff: handoff.module, reason: handoff.reason });
      }
    }
    categorySlug = await pickMixedCategory(sessionId, enabled, user.id);
  }
  if (!categorySlug) return json({ error: 'no implemented categories' }, { status: 500 });

  const state = await getCategoryState(user.id, categorySlug);
  const challenge = await pickChallenge(categorySlug, state.currentLevel, user.id);
  if (!challenge) return json({ error: 'no challenges available' }, { status: 500 });

  const [attempt] = await db.insert(attempts).values({
    sessionId,
    userId: user.id,
    challengeId: challenge.id,
    categorySlug: challenge.categorySlug,
    level: challenge.level,
    scoringModelVersion: SCORING_MODEL_VERSION,
    challengeVersion: challenge.version
  }).returning({ id: attempts.id });

  return json({
    attemptId: attempt.id,
    category: challenge.categorySlug,
    categoryName: implemented.find((c) => c.slug === challenge.categorySlug)?.name ?? challenge.categorySlug,
    level: challenge.level,
    rendererType: challenge.rendererType,
    challengeType: challenge.challengeType,
    promptData: challenge.promptData,
    // scoring transparency: derived from the same mode strings the scorer dispatches on
    scoring: scoringLabel(challenge.scoringMode, null, locals.locale)
  });
};
