import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { abandonAttempt } from '$lib/server/sessions';

// Called via navigator.sendBeacon when a user leaves a challenge mid-way. Marks the still-pending
// attempt as abandoned so it isn't left dangling. Beacons can't set JSON content-type reliably, so we
// parse the body defensively (text or json).
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ ok: false }, { status: 401 });
  let attemptId = '';
  try {
    const text = await request.text();
    if (text) {
      const parsed = JSON.parse(text);
      attemptId = typeof parsed?.attemptId === 'string' ? parsed.attemptId : '';
    }
  } catch {
    attemptId = '';
  }
  if (!attemptId) return json({ ok: false }, { status: 400 });
  try {
    await abandonAttempt(locals.user.id, attemptId);
  } catch {
    // best-effort; never error a beacon
  }
  return json({ ok: true });
};
