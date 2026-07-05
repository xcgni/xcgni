import type { PageServerLoad } from './$types';
import { emailIndexEnabled } from '$lib/server/auth/email-index';

// The email section renders in two truthful variants: the strong claim only when the blind
// index is actually active on this deployment; the plain description otherwise.
export const load: PageServerLoad = async () => {
  return { emailShield: emailIndexEnabled() };
};
