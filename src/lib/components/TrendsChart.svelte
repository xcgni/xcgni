<script lang="ts">
  // Community trends over time. Two honest, clean series get prominence (cumulative users, weekly
  // active); the median-rating line is offered as a secondary, carefully-labelled toggle because
  // it's confounded by who joined when.
  export let points: {
    week: string; cumulativeUsers: number; activeUsers: number; attempts: number; medianRating: number | null;
  }[] = [];

  type Metric = 'growth' | 'activity' | 'rating';
  let metric: Metric = 'growth';

  const W = 640;
  const H = 220;
  const PAD = { l: 44, r: 16, t: 16, b: 28 };

  $: series = points.map((p) => {
    if (metric === 'growth') return p.cumulativeUsers;
    if (metric === 'activity') return p.activeUsers;
    return p.medianRating ?? NaN;
  });
  $: valid = series.filter((v) => Number.isFinite(v));
  $: max = valid.length ? Math.max(...valid) : 1;
  $: min = metric === 'rating' && valid.length ? Math.min(...valid) : 0;
  $: span = max - min || 1;

  function x(i: number): number {
    const n = points.length - 1 || 1;
    return PAD.l + (i / n) * (W - PAD.l - PAD.r);
  }
  function y(v: number): number {
    return H - PAD.b - ((v - min) / span) * (H - PAD.t - PAD.b);
  }

  $: linePath = points
    .map((_, i) => (Number.isFinite(series[i]) ? `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(series[i]).toFixed(1)}` : ''))
    .filter(Boolean)
    .join(' ');

  // area under the line for the growth/activity fill
  $: areaPath = linePath
    ? `${linePath} L${x(points.length - 1).toFixed(1)},${(H - PAD.b).toFixed(1)} L${x(0).toFixed(1)},${(H - PAD.b).toFixed(1)} Z`
    : '';

  $: color = metric === 'rating' ? '#4DA3FF' : metric === 'activity' ? '#4CC38A' : 'rgb(var(--c-accent))';

  function fmtWeek(w: string): string {
    const d = new Date(w + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  $: yTicks = [min, min + span / 2, max].map((v) => Math.round(v));
  $: tabs = [
    ['growth', 'Community growth'],
    ['activity', 'Weekly active'],
    ['rating', 'Median rating']
  ] as [Metric, string][];
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-wrap gap-2">
    {#each tabs as [val, lbl]}
      <button
        class="rounded border px-3 py-1 text-xs transition-colors {metric === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
        on:click={() => (metric = val)}
      >{lbl}</button>
    {/each}
  </div>

  <div class="panel p-4">
    <svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="xMidYMid meet">
      <!-- y gridlines + labels -->
      {#each yTicks as t, i}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#202733" stroke-width="1" />
        <text x={PAD.l - 8} y={y(t) + 4} text-anchor="end" fill="#8C95A3" font-size="11" font-family="monospace">{t}</text>
      {/each}

      {#if metric !== 'rating'}
        <path d={areaPath} fill={color} opacity="0.12" />
      {/if}
      <path d={linePath} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

      <!-- x labels: first, middle, last -->
      {#each [0, Math.floor(points.length / 2), points.length - 1] as i}
        {#if points[i]}
          <text x={x(i)} y={H - 8} text-anchor="middle" fill="#8C95A3" font-size="11" font-family="monospace">{fmtWeek(points[i].week)}</text>
        {/if}
      {/each}
    </svg>

    {#if metric === 'rating'}
      <p class="mt-2 text-xs text-muted">
        A note: this line is shaped by <em>who joins when</em> as much as by anyone improving - new
        users haven't calibrated yet, so movement here isn't "the community getting smarter". Read it
        as context, not a scoreboard.
      </p>
    {:else if metric === 'activity'}
      <p class="mt-2 text-xs text-muted">Distinct people who practised each week.</p>
    {:else}
      <p class="mt-2 text-xs text-muted">Everyone who has joined and consented to share, accumulating over time.</p>
    {/if}
  </div>
</div>
