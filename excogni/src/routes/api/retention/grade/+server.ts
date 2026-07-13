import type { RequestHandler } from './$types';
import { ensureUser } from '$lib/server/auth';
import { gradeRetention } from '$lib/server/retention/session';
import { touchUserSession } from '$lib/server/sessions';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const user = await ensureUser(cookies);
  const body = (await request.json().catch(() => ({}))) as { cardId?: string; answer?: string; elapsedMs?: number };
  if (!body.cardId) {
    return new Response(JSON.stringify({ error: 'missing cardId' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const result = await gradeRetention(user.id, body.cardId, String(body.answer ?? ''), Number(body.elapsedMs ?? 0));
  // A retention card graded mid-mix is session activity - keep the open practice session alive.
  await touchUserSession(user.id);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
};
