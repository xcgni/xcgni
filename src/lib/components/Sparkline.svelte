<script lang="ts">
  // Minimal inline SVG sparkline for the stats trend. Values in [0,1].
  export let values: number[] = [];
  const W = 280;
  const H = 48;

  $: points = values.length > 1
    ? values
        .map((v, i) => {
          const x = (i / (values.length - 1)) * (W - 4) + 2;
          const y = H - 4 - Math.max(0, Math.min(1, v)) * (H - 8);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ')
    : '';
</script>

{#if values.length > 1}
  <svg viewBox="0 0 {W} {H}" class="h-12 w-full" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={points} fill="none" stroke="rgb(var(--c-accent))" stroke-width="1.5" />
  </svg>
{:else}
  <p class="text-xs text-muted">Not enough sessions for a trend yet.</p>
{/if}
