<script lang="ts">
  // The faceless field: distribution of rated users, with your marker on it.
  // No names, no ranking of others - just where you sit in the shape.
  export let buckets: { rating: number; count: number }[] = [];
  export let userRating: number | null = null;
  export let poolSize = 0;

  const W = 640;
  const H = 160;
  const padB = 22;
  const LO = 600;
  const HI = 1900;

  $: maxCount = buckets.length ? Math.max(...buckets.map((b) => b.count)) : 1;
  $: barW = (W / Math.max(buckets.length, 1)) - 2;
  $: xForRating = (r: number) => ((r - LO) / (HI - LO)) * W;
</script>

{#if buckets.length > 2 && poolSize >= 20}
  <svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="none" role="img" aria-label="Rating distribution">
    {#each buckets as b, i}
      <rect
        x={i * (W / buckets.length) + 1}
        y={H - padB - (b.count / maxCount) * (H - padB - 6)}
        width={barW}
        height={(b.count / maxCount) * (H - padB - 6)}
        fill="#2A313D"
      />
    {/each}
    {#if userRating != null}
      <line x1={xForRating(userRating)} y1="2" x2={xForRating(userRating)} y2={H - padB} stroke="rgb(var(--c-accent))" stroke-width="2" />
      <text x={xForRating(userRating)} y={H - 6} text-anchor="middle" font-size="10" fill="rgb(var(--c-accent))" font-family="ui-monospace, monospace">you · {userRating}</text>
    {/if}
    <text x="2" y={H - 6} font-size="9" fill="#8C95A3" font-family="ui-monospace, monospace">{LO}</text>
    <text x={W - 2} y={H - 6} text-anchor="end" font-size="9" fill="#8C95A3" font-family="ui-monospace, monospace">{HI}</text>
  </svg>
  <p class="mt-2 text-center text-xs text-muted">Where {poolSize} rated {poolSize === 1 ? 'person sits' : 'people sit'}, and you among them. No names, no ranking.</p>
{:else}
  <p class="py-6 text-center text-sm text-muted">The distribution appears once enough people are rated.</p>
{/if}
