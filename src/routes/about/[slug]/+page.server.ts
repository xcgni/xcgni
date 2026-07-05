import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { pg } from '$lib/server/db';
import { DOMAIN_LABELS } from '$lib/server/stats';

export const load: PageServerLoad = async ({ params }) => {
  const rows = await pg`
    SELECT slug, name, description, about, domain
    FROM categories WHERE slug = ${params.slug} AND active
  `;
  if (!rows[0]) throw error(404, 'Unknown category');
  // Label resolved here from the one canonical map, so the page can never drift from it
  // (a local copy in the component once went stale when strategic_planning arrived).
  const domainLabel = DOMAIN_LABELS[rows[0].domain as string] ?? rows[0].domain;
  return { category: rows[0], domainLabel };
};
