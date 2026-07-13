import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { revokeAdmin } from '$lib/server/admin/auth';

// POST-only on purpose: a logout that works via GET can be triggered by any embedded
// resource (CSRF logout). SvelteKit also gives POST origin checking for free.
export const POST: RequestHandler = async ({ cookies }) => {
  await revokeAdmin(cookies);
  throw redirect(303, '/admin/login');
};
