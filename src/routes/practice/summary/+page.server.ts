import type { PageServerLoad } from './$types';
import { latestSessionDetail } from '$lib/server/stats';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { session: null, anonymous: true };
  const session = await latestSessionDetail(locals.user.id);
  return { session, anonymous: locals.user.isAnonymous };
};
