import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import { temporalTrends, filterOptions, type AttributeFilter } from '$lib/server/admin/queries';
import { adminConfig } from '$lib/server/flags';

export const load: PageServerLoad = async ({ url, cookies }) => {
  // Defense in depth: the layout gate does not survive refactors (and never covered
  // actions/endpoints); every admin load carries its own awaited check.
  if (!(await isAdmin(cookies))) throw redirect(303, '/admin/login');
  const g = (k: string) => url.searchParams.get(k) || null;
  const filters: AttributeFilter = {
    country: g('country'), nativeLanguage: g('lang')
  };
  const [trends, options] = await Promise.all([temporalTrends(filters), filterOptions()]);
  return { trends, options, filters, minCell: adminConfig.minCell() };
};
