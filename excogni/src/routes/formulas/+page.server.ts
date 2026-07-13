import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Formulas merged into the single methodology info page (which shows formulas + versioned methodology).
export const load: PageServerLoad = async () => {
  throw redirect(308, '/methodology');
};
