import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pg } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { nextRetentionCard, retentionStatus } from '$lib/server/retention/session';
import { touchUserSession } from '$lib/server/sessions';

export const POST: RequestHandler = async ({ cookies, request }) => {
  const user = await ensureUser(cookies);
  try {
    const body = await request.json().catch(() => ({}));
    let decks = Array.isArray(body?.decks) ? body.decks.map(String) : undefined;
    // No explicit deck choice (dedicated-page default AND every in-mix hand-off): honor the
    // user's stored preference from onboarding/Settings. Empty preference = all decks.
    if (!decks || decks.length === 0) {
      const pref = await pg`SELECT preferred_decks FROM user_settings WHERE user_id = ${user.id}`;
      const stored = (pref[0]?.preferred_decks as string[] | null) ?? [];
      if (stored.length > 0) decks = stored;
    }
    await touchUserSession(user.id); // browsing cards mid-mix keeps the session alive
    const [card, status] = await Promise.all([
      nextRetentionCard(user.id, decks),
      retentionStatus(user.id)
    ]);
    return json({ card, status });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'retention unavailable' }, { status: 500 });
  }
};
