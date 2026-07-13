import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { pg } from '$lib/server/db';
import { logout } from '$lib/server/auth';
import { CONSENT_VERSION } from '$lib/server/consent';

export const load: PageServerLoad = async ({ locals }) => {
  let attributes = null;
  let prefs = { sessionLength: 10, enabledCategories: [] as string[] };
  let reminders = { enabled: false, time: '18:00', conditional: false };
  let preferredDecks: string[] = [];
  let publicBadge = false;
  let reducedCategories: string[] = [];
  let categories: { slug: string; name: string }[] = [];
  if (locals.user) {
    const rows = await pg`
      SELECT age_band, country, city, gender, education, native_language, handedness, ext_test_type, ext_test_score, consented_stats
      FROM user_attributes WHERE user_id = ${locals.user.id}
    `;
    attributes = rows[0] ?? null;
    const pr = await pg`SELECT session_length, enabled_categories, reminder_enabled, reminder_time, conditional_enabled, preferred_decks, public_badge, reduced_categories FROM user_settings WHERE user_id = ${locals.user.id}`;
    if (pr[0]) {
      reminders = { enabled: !!pr[0].reminder_enabled, time: pr[0].reminder_time ?? '18:00', conditional: !!pr[0].conditional_enabled };
      preferredDecks = (pr[0].preferred_decks as string[] | null) ?? [];
      publicBadge = !!pr[0].public_badge;
      reducedCategories = (pr[0].reduced_categories as string[] | null) ?? [];
      prefs = {
        sessionLength: pr[0].session_length ?? 10,
        enabledCategories: Array.isArray(pr[0].enabled_categories) ? pr[0].enabled_categories : []
      };
    }
    categories = await pg`SELECT slug, name FROM categories WHERE active AND implemented ORDER BY sort`;
  }
  return {
    user: locals.user
      ? { emailHint: locals.user.emailHint, username: locals.user.username, isAnonymous: locals.user.isAnonymous }
      : null,
    attributes, prefs, categories, reminders, preferredDecks, publicBadge, reducedCategories,
    retentionDecks: await pg`SELECT DISTINCT deck AS slug, deck_label AS label FROM retention_cards WHERE active ORDER BY deck_label`
  };
};

function cleanInt(v: FormDataEntryValue | null, lo: number, hi: number): number | null {
  const n = parseInt(String(v ?? ''), 10);
  if (Number.isNaN(n) || n < lo || n > hi) return null;
  return n;
}
function cleanStr(v: FormDataEntryValue | null, max = 64): string | null {
  const s = String(v ?? '').trim();
  return s.length === 0 ? null : s.slice(0, max);
}

export const actions: Actions = {
  restoreReduced: async ({ locals, request }) => {
    if (!locals.user) return fail(401, { reducedError: 'Not signed in.' });
    const f = await request.formData();
    const slug = String(f.get('slug') ?? '');
    if (!/^[a-z0-9-]{2,40}$/.test(slug)) return fail(400, { reducedError: 'Bad category.' });
    await pg`
      UPDATE user_settings SET reduced_categories = array_remove(reduced_categories, ${slug}), updated_at = now()
      WHERE user_id = ${locals.user.id}
    `;
    return { reducedRestored: true };
  },

  saveBadge: async ({ locals, request }) => {
    if (!locals.user) return fail(401, { badgeError: 'Not signed in.' });
    const f = await request.formData();
    const on = f.get('public_badge') === 'on';
    await pg`
      INSERT INTO user_settings (user_id, public_badge, updated_at)
      VALUES (${locals.user.id}, ${on}, now())
      ON CONFLICT (user_id) DO UPDATE SET public_badge = ${on}, updated_at = now()
    `;
    return { badgeSaved: true };
  },

  saveDecks: async ({ locals, request }) => {
    if (!locals.user) return fail(401, { decksError: 'Not signed in.' });
    const f = await request.formData();
    const validDecks = new Set(
      (await pg`SELECT DISTINCT deck FROM retention_cards WHERE active`).map((r: { deck: string }) => r.deck)
    );
    const chosen = f.getAll('preferred_decks').map(String).filter((d) => validDecks.has(d)).slice(0, 32);
    await pg`
      INSERT INTO user_settings (user_id, preferred_decks, updated_at)
      VALUES (${locals.user.id}, ${chosen}, now())
      ON CONFLICT (user_id) DO UPDATE SET preferred_decks = ${chosen}, updated_at = now()
    `;
    return { decksSaved: true };
  },

  saveReminders: async ({ locals, request }) => {
    if (!locals.user) return fail(401, { remindersError: 'Not signed in.' });
    const f = await request.formData();
    const enabled = f.get('reminder_enabled') === 'on';
    const conditional = f.get('conditional_enabled') === 'on';
    let time = String(f.get('reminder_time') ?? '18:00');
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(time)) time = '18:00';
    await pg`
      INSERT INTO user_settings (user_id, reminder_enabled, reminder_time, conditional_enabled, updated_at)
      VALUES (${locals.user.id}, ${enabled}, ${time}, ${conditional}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        reminder_enabled = ${enabled}, reminder_time = ${time}, conditional_enabled = ${conditional}, updated_at = now()
    `;
    return { remindersSaved: true };
  },

  savePractice: async ({ locals, request }) => {
    if (!locals.user) return fail(401, { prefError: 'Not signed in.' });
    const f = await request.formData();
    let len = parseInt(String(f.get('session_length') ?? '10'), 10);
    if (!Number.isFinite(len) || len < 3) len = 3;
    if (len > 50) len = 50;
    // categories are managed on the practice page (disabled-set model); here we only save session
    // length, taking care NOT to touch disabled_categories.
    await pg`
      INSERT INTO user_settings (user_id, session_length, updated_at)
      VALUES (${locals.user.id}, ${len}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        session_length = ${len}, updated_at = now()
    `;
    return { prefSaved: true };
  },

  saveAttributes: async ({ locals, request }) => {
    if (!locals.user) return fail(401, { attrError: 'Not signed in.' });
    const f = await request.formData();
    const ageBand = cleanStr(f.get('age_band'), 16);
    const country = cleanStr(f.get('country'));
    const city = cleanStr(f.get('city'), 80);
    const gender = cleanStr(f.get('gender'));
    const education = cleanStr(f.get('education'));
    const nativeLanguage = cleanStr(f.get('native_language'));
    const handedness = cleanStr(f.get('handedness'));
    const extTestType = cleanStr(f.get('ext_test_type'));
    const extTestScore = cleanInt(f.get('ext_test_score'), 0, 100000);
    const consented = f.get('consented_stats') === 'on';

    await pg`
      INSERT INTO user_attributes
        (user_id, age_band, country, city, gender, education, native_language, handedness,
         ext_test_type, ext_test_score, consented_stats, consented_data, consent_at, consent_version, updated_at)
      VALUES (${locals.user.id}, ${ageBand}, ${country}, ${city}, ${gender}, ${education},
              ${nativeLanguage}, ${handedness}, ${extTestType}, ${extTestScore}, ${consented}, ${consented}, ${consented ? new Date() : null}, ${consented ? CONSENT_VERSION : null}, now())
      ON CONFLICT (user_id) DO UPDATE SET
        age_band = EXCLUDED.age_band, country = EXCLUDED.country, city = EXCLUDED.city, gender = EXCLUDED.gender,
        education = EXCLUDED.education, native_language = EXCLUDED.native_language,
        handedness = EXCLUDED.handedness, ext_test_type = EXCLUDED.ext_test_type,
        ext_test_score = EXCLUDED.ext_test_score,
        consented_stats = EXCLUDED.consented_stats, consented_data = EXCLUDED.consented_data,
        consent_at = CASE WHEN EXCLUDED.consented_stats THEN COALESCE(user_attributes.consent_at, EXCLUDED.consent_at) ELSE user_attributes.consent_at END,
        consent_version = CASE WHEN EXCLUDED.consented_stats THEN EXCLUDED.consent_version ELSE user_attributes.consent_version END,
        updated_at = now()
    `;
    return { attrSaved: true };
  },

  deleteAccount: async ({ locals, cookies }) => {
    if (!locals.user) throw redirect(303, '/');
    // magic_links is keyed by email identity, not by user FK, so the cascade does not
    // reach it - remove those rows explicitly (both hash-mode and legacy-plaintext rows).
    await pg`
      DELETE FROM magic_links USING users u
      WHERE u.id = ${locals.user.id}
        AND ((u.email_hash IS NOT NULL AND magic_links.email_hash = u.email_hash)
          OR (u.email IS NOT NULL AND magic_links.email = u.email))
    `;
    // ON DELETE CASCADE removes sessions, attempts, ratings, attributes, settings.
    await pg`DELETE FROM users WHERE id = ${locals.user.id}`;
    await logout(cookies);
    throw redirect(303, '/');
  },

  // "Let a friend try": for an anonymous user, end this browser's session so the next visit
  // starts a fresh anonymous account (clean slate). The old anonymous data stays in the DB
  // (still useful in aggregate) but is no longer tied to this browser. Refuses for registered
  // users - they should log out instead, which keeps their account.
  resetAnonymous: async ({ locals, cookies }) => {
    if (!locals.user) throw redirect(303, '/');
    if (!locals.user.isAnonymous) return fail(400, { resetError: 'Only anonymous sessions can be reset. Log out instead to keep your account.' });
    await logout(cookies);            // clears the session cookie; next request makes a fresh anon user
    throw redirect(303, '/welcome');  // fresh start
  }
};
