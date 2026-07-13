import type { PageServerLoad } from './$types';
import contributions from '$lib/data/contributions.json';

export const load: PageServerLoad = async () => {
  return { groups: contributions.groups };
};
