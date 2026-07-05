import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ensureUser } from '$lib/server/auth';
import { setDayNote } from '$lib/server/stats';

export const POST: RequestHandler = async ({ cookies, request }) => {
  const user = await ensureUser(cookies);
  try {
    const body = await request.json().catch(() => ({}));
    const date = typeof body?.date === 'string' ? body.date : '';
    // Validate the date is a plain YYYY-MM-DD before it reaches SQL - reject anything else with a
    // clean 400 rather than letting a malformed value hit Postgres as a 500.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'invalid date' }, { status: 400 });
    }
    // Cap the note; empty note clears the day's note (handled in setDayNote).
    const note = (typeof body?.note === 'string' ? body.note : '').trim().slice(0, 500);
    await setDayNote(user.id, date, note);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'could not save' }, { status: 500 });
  }
};
