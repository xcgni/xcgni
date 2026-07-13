import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveUser } from '$lib/server/auth';
import { submitAttempt } from '$lib/server/sessions';

/**
 * POST /api/practice/submit  body: { attemptId, answer, clientElapsedMs }
 * All validation/scoring/rating happens server-side in submitAttempt.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const user = await resolveUser(cookies);
  if (!user) return json({ error: 'no session' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { attemptId?: string; answer?: string; clientElapsedMs?: number; inputMethod?: string; firstInputMs?: number; editsCount?: number; firstAnswerChanged?: boolean; wordTimes?: number[] }
    | null;
  if (!body?.attemptId || typeof body.answer !== 'string') {
    return json({ error: 'attemptId and answer are required' }, { status: 400 });
  }
  const clientMs =
    typeof body.clientElapsedMs === 'number' && Number.isFinite(body.clientElapsedMs)
      ? Math.round(body.clientElapsedMs)
      : null;
  const inputMethod = ['keyboard', 'touch', 'mouse'].includes(body.inputMethod ?? '')
    ? (body.inputMethod as string)
    : null;

  const result = await submitAttempt(user.id, body.attemptId, body.answer, clientMs, inputMethod, {
    firstInputMs: body.firstInputMs, editsCount: body.editsCount,
    firstAnswerChanged: body.firstAnswerChanged, wordTimes: body.wordTimes
  });
  if ('error' in result) return json(result, { status: 400 });
  return json(result);
};
