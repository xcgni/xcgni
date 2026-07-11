import type { PageServerLoad } from './$types';
import { emailIndexEnabled } from '$lib/server/auth/email-index';

// The homepage renders for everyone, signed in or not - the brand mark is a real way
// back to the start page. The tour it leads to adapts its ending for returning users.
export const load: PageServerLoad = async ({ locals }) => {
  // The "we don't have your email" claim renders ONLY when it is actually true for this
  // deployment (EMAIL_INDEX_KEY set) - a self-hosted instance without the key must not lie.
  return { emailShield: emailIndexEnabled() };
};
