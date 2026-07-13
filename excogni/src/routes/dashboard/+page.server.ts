import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Dashboard was merged into /stats (which is now the user's home: practice launchers on top,
// full analysis below). Keep this route as a permanent redirect so old links/bookmarks work.
export const load: PageServerLoad = async () => {
  throw redirect(308, '/stats');
};
