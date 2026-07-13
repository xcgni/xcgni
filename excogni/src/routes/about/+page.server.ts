import type { PageServerLoad } from './$types';
import { pg } from '$lib/server/db';

// The per-faculty explainers (/about/<slug>) existed but nothing linked to them - orphaned for
// both people and crawlers. This load feeds a small index so every faculty is one click away.
export const load: PageServerLoad = async () => {
  const faculties = await pg`
    SELECT slug, name, description FROM categories WHERE active ORDER BY sort
  `;
  return { faculties };
};
