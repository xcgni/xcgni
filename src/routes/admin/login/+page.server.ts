import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { adminConfig } from '$lib/server/flags';
import { adminLogin, isAdmin } from '$lib/server/admin/auth';

export const load: PageServerLoad = async ({ cookies }) => {
  if (await isAdmin(cookies)) throw redirect(303, '/admin');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    if (!adminConfig.enabled()) return fail(404, { error: 'Not found.' });
    const form = await request.formData();
    const token = String(form.get('token') ?? '').trim();
    const code = String(form.get('code') ?? '').trim();

    let ip = 'unknown';
    try { ip = getClientAddress(); } catch { /* keep 'unknown' - still rate-limited as a bucket */ }

    const result = await adminLogin(token, code, ip, cookies);
    if (!result.ok) {
      if (result.reason === 'locked') {
        return fail(429, { error: 'Too many attempts. Try again in 15 minutes.' });
      }
      // one generic message for every failure mode - no oracle for which factor was wrong
      return fail(401, { error: 'Invalid credentials.' });
    }
    throw redirect(303, '/admin');
  }
};
