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

// Public aggregate export - suppressed, consented explore as CSV. Only groups clearing the
// public floor are included; no individual rows, ever. Honors the active filters + category.
export const GET: RequestHandler = async ({ url }) => {
  const { groupBy, category, filters } = parseParams(url);
  const e = await publicExplore(groupBy, filters, category, flags.statsPreview());

  const filterNote = filters.length ? ' filtered by ' + filters.map((f) => `${f.dimension}=${f.value}`).join(', ') : '';
  const catNote = category ? ` (skill: ${category})` : '';
  const header = `${groupBy},n,median_rating,q1,q3`;
  const lines = e.rows.map((r) => [r.group, r.n, r.medianRating ?? '', r.q1 ?? '', r.q3 ?? ''].join(','));
  const note = `# Excogni global statistics - grouped by ${groupBy}${catNote}${filterNote}\n# Consented, anonymised, aggregate only. Groups below ${e.minCell} withheld.\n`;
  const csv = note + header + '\n' + lines.join('\n') + '\n';

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="excogni-${groupBy}.csv"`
    }
  });
};
