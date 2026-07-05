import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
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
  return { errors, pulse, feedback };
};
