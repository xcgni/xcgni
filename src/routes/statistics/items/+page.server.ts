import type { PageServerLoad } from './$types';
import { flags } from '$lib/server/flags';
import { itemStatistics, ITEM_MIN_N } from '$lib/server/stats/items';

// Item statistics (v1.7.0): classical test theory, public. See stats/items.ts.
export const load: PageServerLoad = async ({ url }) => {
  const preview = flags.statsPreview();
  const category = url.searchParams.get('category');
  const stats = await itemStatistics(preview, category);
  return { ...stats, preview, category, minN: ITEM_MIN_N };
};
