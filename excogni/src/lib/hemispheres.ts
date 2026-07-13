// Hemisphere grouping for the radar. The point: a radar that only measured fast, single-answer
// tasks read as a "who's quicker" leaderboard. Grouping domains into hemispheres reframes it as a
// MAP OF COGNITION TYPES - a slow, deliberate thinker lights up one side even when the fast side is
// modest. Two hemispheres now; a third (divergent/generative) is reserved for creative measures.
//
// This is a presentational/interpretive grouping, not a claim about brain anatomy - the names are
// about the KIND of thinking each domain leans on (quick & reactive vs deliberate & constructive).

export type Hemisphere = 'reactive' | 'deliberate' | 'generative';

export const HEMISPHERES: Record<Hemisphere, { label: string; blurb: string }> = {
  reactive: {
    label: 'Quick & reactive',
    blurb: 'Fast, single-answer thinking under time - perception, speed, recall, fluency.'
  },
  deliberate: {
    label: 'Deliberate & constructive',
    blurb: 'Slower, multi-step thinking - reasoning, working things through, planning, retention.'
  },
  generative: {
    label: 'Open & generative',
    blurb: 'Divergent, imaginative thinking - producing many ideas, strategy, creation. (Emerging.)'
  }
};

// Each cognitive domain -> its hemisphere.
export const DOMAIN_HEMISPHERE: Record<string, Hemisphere> = {
  reaction: 'reactive',
  processing_speed: 'reactive',
  visual: 'reactive',
  retrieval: 'reactive',
  verbal: 'reactive',
  quantitative: 'reactive',

  fluid_reasoning: 'deliberate',
  executive_function: 'deliberate',
  memory: 'deliberate',
  retention: 'deliberate',
  strategic_planning: 'deliberate',

  // future generative domains:
  divergent_thinking: 'generative'
};

export function hemisphereOf(domain: string): Hemisphere {
  return DOMAIN_HEMISPHERE[domain] ?? 'deliberate';
}

// Order domains so each hemisphere is contiguous on the radar (reactive, then deliberate, then
// generative), so the two sides read as distinct arcs rather than being interleaved.
const HEMI_ORDER: Hemisphere[] = ['reactive', 'deliberate', 'generative'];
export function orderByHemisphere<T extends { domain: string }>(domains: T[]): T[] {
  return [...domains].sort((a, b) => {
    const ha = HEMI_ORDER.indexOf(hemisphereOf(a.domain));
    const hb = HEMI_ORDER.indexOf(hemisphereOf(b.domain));
    if (ha !== hb) return ha - hb;
    return a.domain.localeCompare(b.domain);
  });
}
