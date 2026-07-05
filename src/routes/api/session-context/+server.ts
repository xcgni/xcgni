import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ensureUser } from '$lib/server/auth';
import { saveContext } from '$lib/server/sessions/context';
import { VALID_TAG_SLUGS } from '$lib/tags';

export const POST: RequestHandler = async ({ cookies, request }) => {
  const user = await ensureUser(cookies);
  try {
    const body = await request.json().catch(() => ({}));
    // tags: keep only known slugs (defends against arbitrary input); cap count.
    const tags = Array.isArray(body?.tags)
      ? [...new Set(body.tags.filter((t: unknown): t is string => typeof t === 'string' && VALID_TAG_SLUGS.has(t)))].slice(0, 30)
      : null;
    const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
    await saveContext(user.id, {
      localDate: body?.localDate ?? null,
      sleepHours: typeof body?.sleepHours === 'number' ? body.sleepHours : null,
      napped: typeof body?.napped === 'boolean' ? body.napped : null,
      rested: body?.rested ?? null,
      hoursAwake: typeof body?.hoursAwake === 'number' ? body.hoursAwake : null,
      caffeine: body?.caffeine ?? null,
      otherStimulant: typeof body?.otherStimulant === 'boolean' ? body.otherStimulant : null,
      alertness: body?.alertness ?? null,
      mood: body?.mood ?? null,
      tags,
      note,
      deviceKind: body?.deviceKind ?? null
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'could not save' }, { status: 500 });
  }
};
