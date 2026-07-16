import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import { pg } from '$lib/server/db';
import { recentErrors, errorPulse, recentFeedback } from '$lib/server/admin/queries';

export const load: PageServerLoad = async ({ cookies }) => {
  // Defense in depth: the layout gate does not survive refactors (and never covered
  // actions/endpoints); every admin load carries its own awaited check.
  if (!(await isAdmin(cookies))) throw redirect(303, '/admin/login');
  const [errors, pulse, feedback] = await Promise.all([
    recentErrors(50),
    errorPulse(),
    recentFeedback(50)
  ]);
  // Bank saturation: how often are real users re-served an item they already
  // answered? The early-warning gauge for content exhaustion as year-in users
  // accumulate - when a category's repeat share climbs, it is asking for a wave.
  const saturation = await pg`
    SELECT a.category_slug AS slug,
           count(*)::int AS attempts,
           sum(CASE WHEN EXISTS (
             SELECT 1 FROM attempts p
             WHERE p.user_id = a.user_id AND p.challenge_id = a.challenge_id
               AND p.served_at < a.served_at
           ) THEN 1 ELSE 0 END)::int AS repeats
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    WHERE a.served_at > now() - interval '30 days'
      AND u.is_test = false AND u.is_simulated = false
    GROUP BY 1 ORDER BY 1
  `;
  return { errors, pulse, feedback, saturation };
};
