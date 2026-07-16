import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { ensureUser } from '$lib/server/auth';
import { markIntroSeen } from '$lib/server/sessions';
import { pg } from '$lib/server/db';
import { CONSENT_VERSION } from '$lib/server/consent';

export const load: PageServerLoad = async ({ locals, url }) => {
  const next = url.searchParams.get('next') ?? '';
  // Returning users may re-watch the tour freely; the finale adapts (no forms, no
  // register pitch - a single continue). Detected by any recorded attempt.
  let returning = false;
  if (locals.user) {
    const [seen] = await pg`SELECT 1 FROM attempts WHERE user_id = ${locals.user.id} LIMIT 1`;
    returning = !!seen;
  }

  // Deck list for the "what would you like to memorize?" step (empty selection = all decks).
  const decks = await pg`
    SELECT DISTINCT deck AS slug, deck_label AS label FROM retention_cards WHERE active ORDER BY deck_label
  `;
  let preferredDecks: string[] = [];
  if (locals.user) {
    const s = await pg`SELECT preferred_decks FROM user_settings WHERE user_id = ${locals.user.id}`;
    preferredDecks = (s[0]?.preferred_decks as string[] | null) ?? [];
  }
  return {
    next,
    returning,
 decks, preferredDecks };
};

function cleanStr(v: FormDataEntryValue | null, max = 64): string | null {
  const s = String(v ?? '').trim();
  return s.length === 0 ? null : s.slice(0, max);
}

export const actions: Actions = {
  begin: async ({ cookies, request }) => {
    const user = await ensureUser(cookies);
    await markIntroSeen(user.id);

    // Optional first-run static attributes - all skippable. Saved to user_attributes,
    // which also houses them for later editing in Settings. Consent is collected here.
    const f = await request.formData();
    const ageBand = cleanStr(f.get('age_band'), 16);
    const country = cleanStr(f.get('country'));
    const city = cleanStr(f.get('city'), 80);
    const education = cleanStr(f.get('education'));
    const nativeLanguage = cleanStr(f.get('native_language'));
    const handedness = cleanStr(f.get('handedness'));
    // One consent checkbox now covers both: contributing anonymised data to the aggregate
    // statistics AND to the longitudinal research dataset. Kept as two columns so existing
    // gating/queries are unchanged; a single opt-in sets both together.
    const consented = f.get('consented_research') === 'on';
    // preferred retention decks: validate against real deck slugs; empty = all
    const validDecks = new Set(
      (await pg`SELECT DISTINCT deck FROM retention_cards WHERE active`).map((r: { deck: string }) => r.deck)
    );
    const preferredDecks = f.getAll('preferred_decks').map(String).filter((d) => validDecks.has(d)).slice(0, 32);
    await pg`
      INSERT INTO user_settings (user_id, preferred_decks, updated_at)
      VALUES (${user.id}, ${preferredDecks}, now())
      ON CONFLICT (user_id) DO UPDATE SET preferred_decks = ${preferredDecks}, updated_at = now()
    `;
    const consentedStats = consented;
    const consentedData = consented;

    // only write if something was actually provided (don't stamp empty rows)
    if (ageBand || country || city || education || nativeLanguage || handedness || consentedStats || consentedData) {
      const consentStamp = consented ? new Date() : null;
      await pg`
        INSERT INTO user_attributes
          (user_id, age_band, country, city, education, native_language, handedness, consented_stats, consented_data, consent_at, consent_version, updated_at)
        VALUES (${user.id}, ${ageBand}, ${country}, ${city}, ${education}, ${nativeLanguage}, ${handedness}, ${consentedStats}, ${consentedData}, ${consentStamp}, ${consented ? CONSENT_VERSION : null}, now())
        ON CONFLICT (user_id) DO UPDATE SET
          age_band = COALESCE(EXCLUDED.age_band, user_attributes.age_band),
          country = COALESCE(EXCLUDED.country, user_attributes.country),
          city = COALESCE(EXCLUDED.city, user_attributes.city),
          education = COALESCE(EXCLUDED.education, user_attributes.education),
          native_language = COALESCE(EXCLUDED.native_language, user_attributes.native_language),
          handedness = COALESCE(EXCLUDED.handedness, user_attributes.handedness),
          consented_stats = EXCLUDED.consented_stats,
          consented_data = EXCLUDED.consented_data,
          consent_at = CASE WHEN EXCLUDED.consented_stats THEN COALESCE(user_attributes.consent_at, EXCLUDED.consent_at) ELSE user_attributes.consent_at END,
          consent_version = CASE WHEN EXCLUDED.consented_stats THEN EXCLUDED.consent_version ELSE user_attributes.consent_version END,
          updated_at = now()
      `;
    }
    // Return the visitor to what they originally clicked (category, sub-type, pulse),
    // with skipintro appended. Only same-origin relative paths are honored.
    const nextRaw = cleanStr(f.get('next'), 200);
    const next = nextRaw && nextRaw.startsWith('/practice') && !nextRaw.startsWith('//')
      ? nextRaw : '/practice/run';
    const sep = next.includes('?') ? '&' : '?';
    throw redirect(303, next + sep + 'skipintro=1');
  }
};
