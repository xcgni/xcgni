<script lang="ts">
  // Circle radar. The circle median is the reference shape (like the population anchor on the
  // personal radar); individual members can be toggled on as overlays. Honest about missing data:
  // axes with no median are drawn faint, member points that are null are skipped.
  export let domainLabels: { domain: string; label: string }[] = [];
  export let median: { domain: string; median: number | null }[] = [];
  export let members: { displayName: string; isYou: boolean; domains: { domain: string; rating: number | null }[] }[] = [];

  // which members are toggled visible (default: just you, if present)
  let shown = new Set<string>();
  let initialised = false;
  $: if (!initialised && members.length) {
    const you = members.find((m) => m.isYou);
    shown = new Set(you ? [you.displayName] : []);
    initialised = true;
  }
  function toggle(name: string) {
    if (shown.has(name)) shown.delete(name);
    else shown.add(name);
    shown = shown;
  }

  const SIZE = 320;
  const C = SIZE / 2;
  const R = SIZE / 2 - 44;
  // anchor the median at 0.6 radius, same idea as the personal radar
  const ANCHOR = 0.6;
  const MED_REF = 1200; // visual midpoint rating the anchor maps to (display only)
  const SPREAD = 600;   // ratings within +-SPREAD of MED_REF fill the rest of the radius

  $: n = domainLabels.length;
  function angle(i: number): number {
    return (Math.PI * 2 * i) / n - Math.PI / 2;
  }
  function radius(rating: number | null): number {
    if (rating == null) return 0;
    // map rating to radius with the circle median sitting near ANCHOR
    const norm = ANCHOR + ((rating - MED_REF) / SPREAD) * (1 - ANCHOR);
    return Math.max(0.05, Math.min(1, norm)) * R;
  }
  function pt(i: number, rating: number | null): [number, number] {
    const rr = radius(rating);
    return [C + rr * Math.cos(angle(i)), C + rr * Math.sin(angle(i))];
  }
  function shapePath(doms: { domain: string; rating: number | null }[]): string {
    const map = new Map(doms.map((d) => [d.domain, d.rating]));
    const pts = domainLabels.map((dl, i) => {
      const r = map.get(dl.domain) ?? null;
      return r == null ? null : pt(i, r);
    });
    if (pts.every((p) => p == null)) return '';
    return pts.map((p, i) => (p ? `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : '')).filter(Boolean).join(' ') + ' Z';
  }

  const palette = ['rgb(var(--c-accent))', '#4CC38A', '#4DA3FF', '#E5605C', '#B98AE0', '#5BD1C4', '#E0C24D'];
  function colorFor(name: string, isYou: boolean): string {
    if (isYou) return '#FFFFFF';
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
    return palette[h];
  }

  $: medianPath = shapePath(median.map((m) => ({ domain: m.domain, rating: m.median })));
  $: gridLevels = [0.25, 0.5, ANCHOR, 0.8, 1];
</script>

{#if n >= 3}
  <div class="flex flex-col gap-3">
    <svg viewBox="0 0 {SIZE} {SIZE}" class="mx-auto w-full max-w-sm">
      <!-- grid rings -->
      {#each gridLevels as lvl}
        <polygon
          points={domainLabels.map((_, i) => { const a = angle(i); return `${(C + lvl * R * Math.cos(a)).toFixed(1)},${(C + lvl * R * Math.sin(a)).toFixed(1)}`; }).join(' ')}
          fill="none" stroke={lvl === ANCHOR ? '#4DA3FF' : '#202733'} stroke-width={lvl === ANCHOR ? 1.5 : 1} stroke-dasharray={lvl === ANCHOR ? '3 3' : 'none'}
        />
      {/each}
      <!-- spokes + labels -->
      {#each domainLabels as dl, i}
        {@const a = angle(i)}
        <line x1={C} y1={C} x2={C + R * Math.cos(a)} y2={C + R * Math.sin(a)} stroke="#202733" stroke-width="1" />
        <text x={C + (R + 16) * Math.cos(a)} y={C + (R + 16) * Math.sin(a)} text-anchor="middle" dominant-baseline="middle" fill="#8C95A3" font-size="9">{dl.label}</text>
      {/each}

      <!-- median reference shape -->
      {#if medianPath}
        <path d={medianPath} fill="#4DA3FF" fill-opacity="0.08" stroke="#4DA3FF" stroke-width="1.5" stroke-dasharray="4 3" />
      {/if}

      <!-- member overlays -->
      {#each members as m}
        {#if shown.has(m.displayName)}
          {@const p = shapePath(m.domains)}
          {#if p}
            <path d={p} fill={colorFor(m.displayName, m.isYou)} fill-opacity="0.10" stroke={colorFor(m.displayName, m.isYou)} stroke-width="2" />
          {/if}
        {/if}
      {/each}
    </svg>

    <!-- legend / toggles -->
    <div class="flex flex-wrap justify-center gap-2">
      <span class="flex items-center gap-1 rounded border border-edge px-2 py-1 text-xs text-muted">
        <span class="inline-block h-2 w-3" style="border-top: 2px dashed #4DA3FF"></span> Circle median
      </span>
      {#each members as m}
        <button
          class="flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors {shown.has(m.displayName) ? 'border-edge text-body' : 'border-edge/50 text-muted/60'}"
          on:click={() => toggle(m.displayName)}
        >
          <span class="inline-block h-2 w-2 rounded-full" style="background: {colorFor(m.displayName, m.isYou)}; opacity: {shown.has(m.displayName) ? 1 : 0.3}"></span>
          {m.displayName}{m.isYou ? ' (you)' : ''}
        </button>
      {/each}
    </div>
    <p class="text-center text-xs text-muted">
      The dashed blue shape is the circle's median; tap a member to overlay theirs. Only members who
      chose to share ratings appear here.
    </p>
  </div>
{:else}
  <p class="text-center text-xs text-muted">A circle radar appears once members share enough rated practice.</p>
{/if}
