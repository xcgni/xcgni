import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { emailIndexEnabled } from '$lib/server/auth/email-index';

// A registered, logged-in user landing on the marketing homepage almost always wants to get
// straight to practising, not read the pitch again. Send them to /practice. Anonymous visitors
// and logged-out users still see the homepage (they may be deciding whether to start).
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user && !locals.user.isAnonymous) {
    throw redirect(303, '/practice');
  }
  // The "we don't have your email" claim renders ONLY when it is actually true for this
  // deployment (EMAIL_INDEX_KEY set) - a self-hosted instance without the key must not lie.
  return { emailShield: emailIndexEnabled() };
};
