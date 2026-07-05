import type { RequestHandler } from './$types';
import { publicExplore, type BreakdownDim, type ExploreFilter } from '$lib/server/stats/public';
import { flags } from '$lib/server/flags';

const DIMS: BreakdownDim[] = ['age_band', 'country', 'education', 'native_language', 'handedness'];

function parseParams(url: URL) {
  const byParam = url.searchParams.get('by');
  const groupBy: BreakdownDim = DIMS.includes(byParam as BreakdownDim) ? (byParam as BreakdownDim) : 'country';
  const category = url.searchParams.get('category') || null;
  const filters: ExploreFilter[] = [];
  for (const raw of url.searchParams.getAll('f')) {
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const dim = raw.slice(0, idx) as BreakdownDim;
    const value = raw.slice(idx + 1);
    if (!DIMS.includes(dim) || dim === groupBy) continue;
    if (filters.some((f) => f.dimension === dim)) continue;
    filters.push({ dimension: dim, value });
  }
  return { groupBy, category, filters };
}

// Public aggregate export - suppressed, consented explore as JSON. Honors active filters + category.
export const GET: RequestHandler = async ({ url }) => {
  const { groupBy, category, filters } = parseParams(url);
  const e = await publicExplore(groupBy, filters, category, flags.statsPreview());

  const body = JSON.stringify(
    {
      source: 'Excogni global statistics',
      note: 'Consented, anonymised, aggregate only. Groups below the floor are withheld.',
      groupBy,
      category,
      filters,
      floor: e.minCell,
      totalMatched: e.totalMatched,
      suppressedGroups: e.suppressedGroups,
      rows: e.rows
    },
    null,
    2
  );

  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="excogni-${groupBy}.json"`
    }
  });
};
