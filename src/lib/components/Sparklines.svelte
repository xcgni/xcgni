<script lang="ts">
  // Compact per-domain trend lines: at a glance, which areas are moving up, flat, or down.
  export let sparklines: {
    domain: string; label: string; series: number[];
    first: number | null; last: number | null; deltaPct: number | null;
  }[] = [];

  const W = 120;
  const H = 32;
  const PAD = 3;

  function path(series: number[]): string {
    if (series.length < 2) return '';
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const stepX = (W - PAD * 2) / (series.length - 1);
    return series
      .map((v, i) => {
        const x = PAD + i * stepX;
        const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function trendColor(delta: number | null): string {
    if (delta == null) return '#8A93A3';
    if (delta >= 3) return '#4CC38A';   // up
    if (delta <= -3) return '#E5605C';  // down
    return '#8A93A3';                   // flat
  }
</script>

{#if sparklines.length > 0}
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each sparklines as s}
      <div class="panel flex items-center justify-between gap-3 p-3">
        <div class="flex flex-col">
          <p class="text-sm text-body">{s.label}</p>
          <p class="font-mono text-xs text-muted">
            {s.first} → {s.last}
            {#if s.deltaPct != null}
              <span style="color: {trendColor(s.deltaPct)}">({s.deltaPct >= 0 ? '+' : ''}{s.deltaPct}%)</span>
            {/if}
          </p>
        </div>
        <svg width={W} height={H} viewBox="0 0 {W} {H}" class="shrink-0">
          <path d={path(s.series)} fill="none" stroke={trendColor(s.deltaPct)} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    {/each}
  </div>
{/if}
