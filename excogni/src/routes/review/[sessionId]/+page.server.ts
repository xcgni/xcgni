import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { sessionAttempts, userSessions } from '$lib/server/stats';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw error(401, 'Please log in to view this session.');
  const sessions = await userSessions(locals.user.id, 200);
  const summary = sessions.find((s) => s.id === params.sessionId);
  if (!summary) throw error(404, 'Session not found.');
  const attempts = await sessionAttempts(locals.user.id, params.sessionId);
  return { summary, attempts };
};
