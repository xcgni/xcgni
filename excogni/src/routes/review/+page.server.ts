import type { PageServerLoad } from './$types';
import { userSessions } from '$lib/server/stats';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { sessions: [] };
  const sessions = await userSessions(locals.user.id, 40);
  return { sessions };
};
