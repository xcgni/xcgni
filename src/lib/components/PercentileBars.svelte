<script lang="ts">
  // Where you sit vs everyone, per domain, as a percentile. The most legible "how do I compare"
  // device. Honest: shows a gap where there isn't enough population to rank against.
  export let percentiles: {
    domain: string; label: string; percentile: number | null; rating: number | null; popN: number;
  }[] = [];

  $: ranked = [...percentiles].sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1));

  function barColor(p: number): string {
    if (p >= 66) return '#4CC38A';
    if (p >= 33) return 'rgb(var(--c-accent))';
    return '#E5605C';
  }
</script>

{#if percentiles.some((p) => p.percentile != null)}
  <div class="flex flex-col gap-2">
    {#each ranked as p}
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-sm text-body">{p.label}</span>
        {#if p.percentile != null}
          <div class="relative h-2 flex-1 overflow-hidden rounded bg-edge/50">
            <div class="h-full rounded" style="width: {p.percentile}%; background: {barColor(p.percentile)}"></div>
          </div>
          <span class="w-16 shrink-0 text-right font-mono text-xs text-muted">{p.percentile}th</span>
        {:else}
          <div class="h-2 flex-1 rounded bg-edge/20"></div>
          <span class="w-16 shrink-0 text-right text-xs text-muted"> - </span>
        {/if}
      </div>
    {/each}
  </div>
  <p class="mt-1 text-xs text-muted">
    Your rank against everyone else, per area - higher is ahead of more people. Areas without enough
    community data to rank against are left blank rather than guessed.
  </p>
{/if}
