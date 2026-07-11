import type { PageServerLoad } from './$types';
import { flags } from '$lib/server/flags';
import { commonsFindings } from '$lib/server/stats/commons';

// Commons findings (v1.6.0): the pool gives back. Public, consented-only, floor-gated.
export const load: PageServerLoad = async ({ locals }) => {
  const preview = flags.statsPreview();
  const { findings, poolUsers } = await commonsFindings(preview, locals.locale);
  return { findings, poolUsers, preview };
};
