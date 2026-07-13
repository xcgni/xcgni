<script lang="ts">
  // One row of the page's shared statistical grammar: a group's middle 50% as a band,
  // its median as a solid tick, on a rating axis shared with its siblings - plus an
  // optional dashed reference line (the whole-population median) so every group reads
  // as above/below the commons at a glance. Numbers stay printed; the strip adds
  // comparability, it never replaces the figures.
  export let label: string;
  export let n: number | null = null;
  export let median: number | null;
  export let q1: number | null = null;
  export let q3: number | null = null;
  export let min: number;          // shared axis start
  export let max: number;          // shared axis end
  export let reference: number | null = null;
  export let href: string | null = null;

  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  $: span = Math.max(1, max - min);
  $: pct = (v: number) => clamp(((v - min) / span) * 100);
</script>

<div class="flex flex-col gap-1 py-1.5 sm:grid sm:grid-cols-[9.5rem_1fr_auto] sm:items-center sm:gap-3">
  <div class="min-w-0 truncate text-sm">
    {#if href}
      <a {href} class="text-body hover:text-accent">{label}</a>
    {:else}
      <span class="text-body">{label}</span>
    {/if}
  </div>

  <div class="relative h-5" role="img"
    aria-label={median != null
      ? `${label}: median ${median}${q1 != null && q3 != null ? `, middle 50% ${q1} to ${q3}` : ''}${n != null ? `, ${n} people` : ''}`
      : `${label}: withheld - group below the anonymity floor`}>
    <!-- axis baseline -->
    <span class="absolute left-0 right-0 top-1/2 h-px bg-edge"></span>
    {#if reference != null}
      <span class="absolute top-0 bottom-0 border-l border-dashed border-muted/50" style="left: {pct(reference)}%"></span>
    {/if}
    {#if median != null}
      {#if q1 != null && q3 != null}
        <span class="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm bg-accent/25"
          style="left: {pct(q1)}%; width: {Math.max(0.75, pct(q3) - pct(q1))}%"></span>
      {/if}
      <span class="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-accent" style="left: {pct(median)}%"></span>
    {:else}
      <span class="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] tracking-wide text-muted">withheld - group too small</span>
    {/if}
  </div>

  <div class="flex items-baseline gap-3 font-mono text-xs sm:justify-end">
    {#if median != null}
      <span class="text-accent">{median}</span>
      {#if q1 != null && q3 != null}<span class="text-muted">{q1}-{q3}</span>{/if}
    {/if}
    {#if n != null}<span class="text-muted">n={n}</span>{/if}
  </div>
</div>
