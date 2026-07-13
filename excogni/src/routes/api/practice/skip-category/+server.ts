import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';
import { resolveUser } from '$lib/server/auth';
import { ensureSession, excludeCategory } from '$lib/server/sessions';

/**
 * "Not this category" - two scopes:
 *  - session: mute the category for the remainder of THIS session (a mood, not a preference)
 *  - forever: also write the enabled-categories preference (same as the Practice-page toggle)
 * Either way, the current pending attempt in that category is marked status='skipped' - the
 * attempt row already carries local_hour/local_dow, so avoidance patterns become minable
 * ("tends to skip numerical fluency in the mornings"). A refusal is also a measurement.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const user = await resolveUser(cookies);
  if (!user) return json({ error: 'no session' }, { status: 401 });

  let body: { slug?: string; scope?: string } = {};
  try { body = await request.json(); } catch { /* fall through to validation */ }
  const slug = String(body.slug ?? '');
  const scope = body.scope === 'forever' ? 'forever' : body.scope === 'reduce' ? 'reduce' : 'session';
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return json({ error: 'bad slug' }, { status: 400 });

  const sessionId = await ensureSession(user.id);

  // session mute (idempotent append)
  await pg`
    UPDATE practice_sessions
    SET skipped_categories = array_append(skipped_categories, ${slug})
    WHERE id = ${sessionId} AND NOT (${slug} = ANY(skipped_categories))
  `;

  // the skip event: close the pending attempt as skipped (keeps its local-time context)
  await pg`
    UPDATE attempts SET status = 'skipped', submitted_at = now()
    WHERE user_id = ${user.id} AND session_id = ${sessionId}
      AND category_slug = ${slug} AND status = 'pending'
  `;

  let enabled: string[] | null = null;
  if (scope === 'forever') enabled = await excludeCategory(user.id, slug);
  if (scope === 'reduce') {
    // "show less often": persistent downweight (~35% of normal frequency), restorable in Settings.
    await pg`
      INSERT INTO user_settings (user_id, reduced_categories, updated_at)
      VALUES (${user.id}, ARRAY[${slug}]::text[], now())
      ON CONFLICT (user_id) DO UPDATE
        SET reduced_categories = (
          SELECT CASE WHEN ${slug} = ANY(user_settings.reduced_categories)
            THEN user_settings.reduced_categories
            ELSE array_append(user_settings.reduced_categories, ${slug}) END
        ), updated_at = now()
    `;
  }

  return json({ ok: true, scope, enabled });
};
