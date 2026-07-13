import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import { ratingDistributionAdmin, filterOptions, type AttributeFilter } from '$lib/server/admin/queries';
import { adminConfig } from '$lib/server/flags';

function parseFilters(url: URL): AttributeFilter {
  const g = (k: string) => url.searchParams.get(k) || null;
  return {
    ageBand: g('ageBand'),
    country: g('country'), gender: g('gender'), education: g('education'),
    nativeLanguage: g('lang'), handedness: g('hand')
  };
}

export const load: PageServerLoad = async ({ url, cookies }) => {
  // Defense in depth: the layout gate does not survive refactors (and never covered
  // actions/endpoints); every admin load carries its own awaited check.
  if (!(await isAdmin(cookies))) throw redirect(303, '/admin/login');
  const filters = parseFilters(url);
  const [distribution, options] = await Promise.all([
    ratingDistributionAdmin(filters),
    filterOptions()
  ]);
  const active = Object.entries(filters).filter(([, v]) => v != null).length;
  return { distribution, options, filters, active, minCell: adminConfig.minCell() };
};
