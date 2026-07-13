import type { PageServerLoad } from './$types';
import {
  publicStats,
  publicExplore,
  publicBehavioral,
  publicTrends,
  type BreakdownDim,
  type ExploreFilter
} from '$lib/server/stats/public';
import { implementedCategories } from '$lib/server/challenges';
import { flags } from '$lib/server/flags';
import { AGE_BANDS, COUNTRIES, LANGUAGES, EDUCATION, HANDEDNESS } from '$lib/demographics';

const DIMS: BreakdownDim[] = ['age_band', 'country', 'education', 'native_language', 'handedness'];

function vals(arr: unknown[]): string[] {
  return arr.map((c) => {
    if (typeof c === 'string') return c;
    const o = c as { value?: string; name?: string };
    return o.value ?? o.name ?? String(c);
  });
}

const DIM_VALUES: Record<BreakdownDim, string[]> = {
  age_band: AGE_BANDS as string[],
  country: vals(COUNTRIES as unknown[]),
  native_language: vals(LANGUAGES as unknown[]),
  education: vals(EDUCATION as unknown[]),
  handedness: vals(HANDEDNESS as unknown[])
};

const DIM_LABELS: Record<BreakdownDim, string> = {
  age_band: 'Age',
  country: 'Country',
  education: 'Education',
  native_language: 'Native language',
  handedness: 'Handedness'
};

// Public, no auth - the aggregate picture is open to everyone. All data here is consented and
// suppressed (see stats/public.ts): EVERY final group is withheld if it has fewer than the
// public floor (>=50) of people, however the population is sliced. No individual is ever exposed.
// In preview mode (STATS_PREVIEW flag, never on in prod) simulated users are included so the page
// can be demoed before real consented users exist - clearly labeled.
export const load: PageServerLoad = async ({ url, locals }) => {
  const preview = flags.statsPreview();
  const cats = await implementedCategories();

  const byParam = url.searchParams.get('by');
  const groupBy: BreakdownDim = DIMS.includes(byParam as BreakdownDim) ? (byParam as BreakdownDim) : 'country';

  const catParam = url.searchParams.get('category');
  const category = cats.some((c) => c.slug === catParam) ? catParam : null;

  const filters: ExploreFilter[] = [];
  for (const raw of url.searchParams.getAll('f')) {
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const dim = raw.slice(0, idx) as BreakdownDim;
    const value = raw.slice(idx + 1);
    if (!DIMS.includes(dim)) continue;
    if (dim === groupBy) continue;
    if (!(DIM_VALUES[dim] ?? []).includes(value)) continue;
    if (filters.some((f) => f.dimension === dim)) continue;
    filters.push({ dimension: dim, value });
  }


  return {
    stats: await publicStats(preview),
    behavioral: await publicBehavioral(preview),
    trends: await publicTrends(preview),

    explore: await publicExplore(groupBy, filters, category, preview),
    groupBy,
    category,
    filters,
    dims: DIMS,
    dimLabels: DIM_LABELS,
    dimValues: DIM_VALUES,
    categories: cats
  };
};
