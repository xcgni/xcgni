import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin/auth';
import { adminConfig } from '$lib/server/flags';

export const load: PageServerLoad = async ({ cookies }) => {
  // Defense in depth: the layout gate does not survive refactors (and never covered
  // actions/endpoints); every admin load carries its own awaited check.
  if (!(await isAdmin(cookies))) throw redirect(303, '/admin/login');
  return { minCell: adminConfig.minCell() };
};
