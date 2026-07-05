<script lang="ts">
  // A calm rating-over-time line chart. Pure SVG, no dependencies.
  // Expects points: { t: ISO string, rating: number }[].
  export let points: { t: string; rating: number }[] = [];
  export let height = 180;

  const W = 640;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 24;

  $: ratings = points.map((p) => p.rating);
  $: hasData = points.length > 1;
  $: min = hasData ? Math.min(...ratings) : 0;
  $: max = hasData ? Math.max(...ratings) : 0;
  // pad the range a little so the line isn't glued to the edges
  $: lo = hasData ? Math.floor((min - 20) / 50) * 50 : 0;
  $: hi = hasData ? Math.ceil((max + 20) / 50) * 50 : 100;
  $: span = Math.max(hi - lo, 1);

  $: xAt = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * (W - padL - padR);
  $: yAt = (r: number) => padT + (1 - (r - lo) / span) * (height - padT - padB);

  $: linePath = hasData
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(p.rating).toFixed(1)}`).join(' ')
    : '';
  $: areaPath = hasData
    ? `${linePath} L${xAt(points.length - 1).toFixed(1)},${(height - padB).toFixed(1)} L${padL},${(height - padB).toFixed(1)} Z`
    : '';

  // y gridlines at lo, mid, hi
  $: yTicks = hasData ? [lo, Math.round((lo + hi) / 2), hi] : [];
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
</script>

{#if hasData}
  <svg viewBox="0 0 {W} {height}" class="w-full" preserveAspectRatio="none" role="img" aria-label="Rating over time">
    {#each yTicks as t}
      <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke="#202733" stroke-width="1" />
      <text x={padL - 8} y={yAt(t) + 3} text-anchor="end" font-size="10" fill="#8C95A3" font-family="ui-monospace, monospace">{t}</text>
    {/each}
    <path d={areaPath} fill="rgb(var(--c-accent))" opacity="0.06" />
    <path d={linePath} fill="none" stroke="rgb(var(--c-accent))" stroke-width="1.5" />
    {#each points as p, i}
      {#if i === 0 || i === points.length - 1}
        <circle cx={xAt(i)} cy={yAt(p.rating)} r="2.5" fill="rgb(var(--c-accent))" />
        <text x={xAt(i)} y={height - 8} text-anchor={i === 0 ? 'start' : 'end'} font-size="10" fill="#8C95A3" font-family="ui-monospace, monospace">{fmtDate(p.t)}</text>
      {/if}
    {/each}
  </svg>
{:else}
  <p class="py-8 text-center text-sm text-muted">Not enough rated attempts yet to chart a trend.</p>
{/if}
