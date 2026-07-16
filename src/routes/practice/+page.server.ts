import type { PageServerLoad, Actions } from './$types';
import { pg } from '$lib/server/db';
import { ensureUser } from '$lib/server/auth';
import { getEnabledCategories, setEnabledCategories } from '$lib/server/sessions';
import { userReadiness } from '$lib/server/stats';
import { cognitiveWeather } from '$lib/server/insights/forecast';
import { emailIndexEnabled } from '$lib/server/auth/email-index';

export const load: PageServerLoad = async ({ locals }) => {
  const weather = locals.user ? await cognitiveWeather(locals.user.id, locals.locale) : null;
  const cats = await pg`
    SELECT slug, name, description, implemented FROM categories WHERE active ORDER BY sort
  `;
  // what each category is made of, so the picker can say it
  const typeRows = await pg`
    SELECT category_slug, challenge_type FROM challenges
    WHERE active AND lang = 'en' GROUP BY 1, 2 ORDER BY 1, 2
  `;
  const typesBySlug: Record<string, string[]> = {};
  for (const r of typeRows) {
    (typesBySlug[r.category_slug as string] ??= []).push(r.challenge_type as string);
  }
  const enabled = locals.user ? await getEnabledCategories(locals.user.id) : null;
  const enabledSet = enabled ? new Set(enabled) : null;
  // profile completeness, so a new user sees their progress filling in right where they practise
  const readiness = locals.user && !locals.user.isAnonymous ? await userReadiness(locals.user.id) : null;
  return {
    weather,
    emailShield: emailIndexEnabled(),
    readiness,
    categories: cats.map((c) => ({
      slug: c.slug as string,
      name: c.name as string,
      description: c.description as string,
      implemented: c.implemented as boolean,
      // anonymous (no user) => all on; otherwise on unless the user disabled it
      enabled: enabledSet ? enabledSet.has(c.slug as string) : true,
      types: typesBySlug[c.slug as string] ?? []
    }))
  };
};

export const actions: Actions = {
  saveCategories: async ({ request, cookies }) => {
    const user = await ensureUser(cookies);
    const form = await request.formData();
    const slugs = form.getAll('category').map(String);
    await setEnabledCategories(user.id, slugs);
    return { saved: true };
  }
};
