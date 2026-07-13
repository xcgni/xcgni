<script lang="ts">
  import { orderByHemisphere } from '$lib/hemispheres';
  // Cognitive fingerprint: domains as axes, a single accent polygon.
  // Unrated/partial axes render dim and pulled toward center, never as a
  // confident zero. Rating range anchored to a fixed scale so shape means something.
  export let domains: {
    domain: string; label: string; rating: number | null;
    status: 'ok' | 'partial' | 'unrated'; members: number; ratedMembers: number;
  }[] = [];
  // group the axes by hemisphere so the two kinds of cognition read as distinct arcs
  export let groupByHemisphere = true;
  $: orderedDomains = groupByHemisphere ? orderByHemisphere(domains) : domains;
  // optional historical per-domain min/max → drawn as faint "range" planes around current
  export let ranges: { domain: string; min: number | null; max: number | null }[] = [];
  // optional population median per domain → drawn as a blue reference line
  export let population: { domain: string; median: number | null }[] = [];
  $: rangeByDomain = new Map(ranges.map((r) => [r.domain, r]));
  $: showRanges = ranges.length > 0;
  $: popByDomain = new Map(population.map((p) => [p.domain, p]));
  $: showPopulation = population.some((p) => p.median != null);

  const SIZE = 320;
  const PAD = 110; // horizontal breathing room so the longest edge labels ("Processing Speed") are not clipped
  const C = SIZE / 2;
  const R = SIZE / 2 - 54; // leave room for labels
  const LO = 600;
  const HI = 1900;

  $: n = orderedDomains.length;
  $: angleAt = (i: number) => (Math.PI * 2 * i) / Math.max(n, 1) - Math.PI / 2;

  // Scale design:
  // - When population data exists, ANCHOR it: the population median sits at a fixed reference
  //   radius (POP_ANCHOR of R) on every user's chart, so the "crowd" is always in the same place
  //   and a user's polygon reads as deviation from it - bulging outside where they're above the
  //   median, inside where they're below. This is what makes radars comparable between people.
  // - The scale still zooms to encompass the actual spread (user ratings + range planes), but it
  //   is centred on the population anchor rather than floating to each user's own peak.
  // - With no population data, fall back to a simple adaptive fit (early-days behaviour).
  const POP_ANCHOR = 0.6; // population median ring sits at 60% of the radius

  $: ratings = orderedDomains.map((d) => d.rating).filter((r): r is number => r != null);
  $: rangeVals = showRanges
    ? ranges.flatMap((r) => [r.min, r.max]).filter((v): v is number => v != null)
    : [];
  $: popVals = showPopulation
    ? population.map((p) => p.median).filter((v): v is number => v != null)
    : [];

  // the population anchor value = typical population median across axes
  $: popAnchor = popVals.length ? popVals.reduce((a, b) => a + b, 0) / popVals.length : null;

  $: allVals = [...ratings, ...rangeVals, ...popVals];
  $: dataMax = allVals.length ? Math.max(...allVals) : HI;
  $: dataMin = allVals.length ? Math.min(...allVals) : LO;

  // norm(): map a rating to a 0..1 radius.
  $: norm = (rating: number | null): number => {
    if (rating == null) return 0.1; // dim stub toward centre, not zero

    if (popAnchor != null) {
      // population-anchored: popAnchor maps to POP_ANCHOR. Pick a per-point span so the
      // furthest data point still fits inside the chart, shared above & below the anchor so
      // the geometry is symmetric and honest. Min span keeps small spreads from exploding.
      const maxDev = Math.max(
        Math.abs(dataMax - popAnchor),
        Math.abs(dataMin - popAnchor),
        120 // floor so a tight cluster doesn't over-magnify noise
      );
      // value above anchor extends toward the rim (1.0), below toward centre (0.1)
      const headroom = 1 - POP_ANCHOR;       // space above the anchor ring
      const footroom = POP_ANCHOR - 0.1;     // space below it (down to the centre stub)
      if (rating >= popAnchor) {
        return Math.min(1, POP_ANCHOR + ((rating - popAnchor) / maxDev) * headroom);
      }
      return Math.max(0.1, POP_ANCHOR - ((popAnchor - rating) / maxDev) * footroom);
    }

    // adaptive fallback (no population data yet)
    const scaleHi = Math.min(HI, Math.ceil((dataMax + 60) / 50) * 50);
    const scaleLo = Math.max(LO, Math.floor((dataMin - 60) / 50) * 50);
    const span = Math.max(50, scaleHi - scaleLo);
    return Math.max(0.1, Math.min(1, (rating - scaleLo) / span));
  };
  const pt = (angle: number, r: number) => ({
    x: C + Math.cos(angle) * r,
    y: C + Math.sin(angle) * r
  });
  // min/max plane polygons (per-domain historical extremes), in the same scale
  $: maxPlane = showRanges ? orderedDomains.map((d, i) => {
    const r = rangeByDomain.get(d.domain);
    const p = pt(angleAt(i), norm(r?.max ?? d.rating) * R);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ') : '';
  $: minPlane = showRanges ? orderedDomains.map((d, i) => {
    const r = rangeByDomain.get(d.domain);
    const p = pt(angleAt(i), norm(r?.min ?? d.rating) * R);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ') : '';
  // Population reference: a dot on each axis that has real (unsuppressed) population data.
  // Missing/suppressed axes simply get no dot - an honest gap, never a fallback onto the
  // user's own value. Where present, the dots sit on the fixed anchor-relative scale, so
  // across users the population sits in a consistent place.
  $: popDots = showPopulation
    ? orderedDomains
        .map((d, i) => {
          const pop = popByDomain.get(d.domain);
          if (!pop || pop.median == null) return null;
          const p = pt(angleAt(i), norm(pop.median) * R);
          return { x: p.x, y: p.y };
        })
        .filter((p): p is { x: number; y: number } => p !== null)
    : [];
  $: polygon = orderedDomains
    .map((d, i) => {
      const p = pt(angleAt(i), norm(d.rating) * R);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
  $: rings = [0.25, 0.5, 0.75, 1].map((f) =>
    orderedDomains.map((_, i) => {
      const p = pt(angleAt(i), f * R);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ')
  );
  // rating value at each ring radius, for honest scale labels. This is the inverse of norm():
  // given a ring at fraction f of the radius, what rating sits there? Must mirror both the
  // population-anchored path and the adaptive fallback so the printed numbers stay truthful.
  $: invNorm = (f: number): number => {
    if (popAnchor != null) {
      const maxDev = Math.max(
        Math.abs(dataMax - popAnchor),
        Math.abs(dataMin - popAnchor),
        120
      );
      const headroom = 1 - POP_ANCHOR;
      const footroom = POP_ANCHOR - 0.1;
      if (f >= POP_ANCHOR) {
        return popAnchor + ((f - POP_ANCHOR) / headroom) * maxDev;
      }
      return popAnchor - ((POP_ANCHOR - f) / footroom) * maxDev;
    }
    const scaleHi = Math.min(HI, Math.ceil((dataMax + 60) / 50) * 50);
    const scaleLo = Math.max(LO, Math.floor((dataMin - 60) / 50) * 50);
    const span = Math.max(50, scaleHi - scaleLo);
    return scaleLo + f * span;
  };
  $: ringLabels = [0.25, 0.5, 0.75, 1].map((f) => Math.round(invNorm(f)));
</script>

{#if n >= 3}
  <svg viewBox="{-PAD} 0 {SIZE + PAD * 2} {SIZE}" class="mx-auto w-full max-w-md" role="img" aria-label="Cognitive domain profile">
    <!-- grid rings -->
    {#each rings as ring, ri}
      <polygon points={ring} fill="none" stroke="#202733" stroke-width="1" />
    {/each}
    <!-- honest scale: rating value at outer + mid ring (top axis), so the adaptive
         fill is read relative to the real range, not mistaken for absolute -->
    <text x={C} y={C - R - 2} text-anchor="middle" font-size="9" fill="#5A6373" font-family="ui-monospace, monospace">{ringLabels[3]}</text>
    <text x={C} y={C - R * 0.5 - 2} text-anchor="middle" font-size="8" fill="#3A4150" font-family="ui-monospace, monospace">{ringLabels[1]}</text>
    <!-- spokes -->
    {#each orderedDomains as _, i}
      {@const p = pt(angleAt(i), R)}
      <line x1={C} y1={C} x2={p.x} y2={p.y} stroke="#202733" stroke-width="1" />
    {/each}
    <!-- the fingerprint polygon -->
    {#if showRanges}
      <!-- historical best (bright white, long dash) and worst (vivid red, short dash) -->
      <polygon points={maxPlane} fill="none" stroke="#FFFFFF" stroke-width="1.75" stroke-opacity="0.85" stroke-dasharray="8 4" stroke-linejoin="round" />
      <polygon points={minPlane} fill="none" stroke="#FF5A47" stroke-width="1.75" stroke-opacity="0.85" stroke-dasharray="2 4" stroke-linejoin="round" />
    {/if}
    {#if showPopulation}
      <!-- population median (vivid blue, dotted) - distinct dash signature from white best -->
      {#each popDots as dot}
        <circle cx={dot.x} cy={dot.y} r="3.5" fill="#4DA3FF" fill-opacity="0.95" />
      {/each}
    {/if}
    <polygon points={polygon} fill="rgb(var(--c-accent))" fill-opacity="0.16" stroke="rgb(var(--c-accent))" stroke-width="2.25" />
    <!-- vertices + labels -->
    {#each orderedDomains as d, i}
      {@const a = angleAt(i)}
      {@const v = pt(a, norm(d.rating) * R)}
      {@const lab = pt(a, R + 22)}
      <circle cx={v.x} cy={v.y} r="2.5" fill={d.status === 'unrated' ? '#3A4150' : 'rgb(var(--c-accent))'} />
      <text
        x={lab.x} y={lab.y}
        text-anchor={Math.abs(Math.cos(a)) < 0.3 ? 'middle' : lab.x > C ? 'start' : 'end'}
        dominant-baseline="middle"
        font-size="10"
        fill={d.status === 'unrated' ? '#6b7280' : '#8C95A3'}
        font-family="ui-monospace, monospace"
      >{d.label}</text>
      {#if d.status !== 'unrated'}
        <text
          x={lab.x} y={lab.y + 12}
          text-anchor={Math.abs(Math.cos(a)) < 0.3 ? 'middle' : lab.x > C ? 'start' : 'end'}
          font-size="9" fill="rgb(var(--c-accent))" font-family="ui-monospace, monospace"
        >{d.rating}{d.status === 'partial' ? '·' : ''}</text>
      {/if}
    {/each}
  </svg>
  {#if orderedDomains.some((d) => d.status === 'partial')}
    <p class="mt-2 text-center text-xs text-muted">· marks domains where only some categories are rated so far.</p>
  {/if}
  {#if groupByHemisphere}
    <div class="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span><span class="text-body">Quick &amp; reactive</span> and <span class="text-body">deliberate &amp; constructive</span> sit on opposite arcs - the radar maps the <em>kind</em> of thinking, not just speed.</span>
    </div>
  {/if}
{:else}
  <p class="py-8 text-center text-sm text-muted">Practice a few categories to see your cognitive profile.</p>
{/if}
