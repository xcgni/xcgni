import type { LayoutServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { adminConfig } from '$lib/server/flags';
import { isAdmin } from '$lib/server/admin/auth';

// Standalone admin gate. Not a user role. Login lives at /admin/login (token + TOTP);
// the old ?key=<token> URL login is gone - secrets don't belong in URLs (access logs,
// CDN logs, history, Referer).
export const load: LayoutServerLoad = async ({ url, cookies }) => {
  if (!adminConfig.enabled()) {
    throw error(404, 'Not found');
  }
  if (url.pathname === '/admin/login') {
    return { minCell: adminConfig.minCell(), isLogin: true };
  }
  if (!(await isAdmin(cookies))) {
    throw redirect(303, '/admin/login');
  }
  return { minCell: adminConfig.minCell(), isLogin: false };
};
