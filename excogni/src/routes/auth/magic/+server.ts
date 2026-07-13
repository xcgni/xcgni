import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { consumeMagicLink } from '$lib/server/auth';
import { log } from '$lib/server/log';
import { pg } from '$lib/server/db';

// Default landing after sign-in. Practice is useful to everyone (new and returning) and never shows
// the empty-stats screen a brand-new account would otherwise hit; stats is one click away in the nav.
const DEFAULT_LANDING = '/practice';

function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return DEFAULT_LANDING;
  return target;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token');
  const redirectTo = safeRedirect(url.searchParams.get('redirect'));
  if (!token) throw redirect(303, '/auth/login?invalid=1');
  const user = await consumeMagicLink(token, cookies);
  log.authMagicConsumed(!!user);
  if (!user) throw redirect(303, '/auth/login?expired=1');
  // First step after login, "getting to know you": if this account has never answered the
  // about-you step (no attributes row), land on /welcome instead of practice. An explicitly
  // requested redirect still wins (deep links). Completed profiles never see this detour.
  if (redirectTo === DEFAULT_LANDING) {
    const attr = await pg`SELECT 1 FROM user_attributes WHERE user_id = ${user.id}`;
    if (attr.length === 0) throw redirect(303, '/welcome');
  }
  throw redirect(303, redirectTo);
};
