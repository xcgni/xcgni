<script lang="ts">
  // The signature element: an instrument readout. Large tabular mono numerals,
  // a hairline percentile bar, quiet uppercase labels. Honest about calibration.
  import { ordinal } from '$lib/rating-format';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  export let label: string;
  export let rating: number | null;
  export let percentile: number | null = null;
  export let status: 'ok' | 'calibrating' | 'unrated' = 'unrated';
  export let provisional = false;
  export let poolSize: number | null = null;
  export let delta: number | null = null;
  export let sem: number | null = null;
  export let big = false;
  export let href: string | null = null;
  // C3: optional 30-day mini-trend (values 0..1, only days with data - gaps stay honest)
  export let spark: number[] | null = null;

  // C2: the ±SEM band drawn on a fixed ±150-rating-point axis, so a settled rating shows a
  // narrow band and a fresh one shows a wide band - uncertainty made visible, not implied.
  const SEM_AXIS = 150;
  $: semPct = sem != null ? Math.min(100, (sem / SEM_AXIS) * 100) : 0;

  $: sparkPoints = spark && spark.length > 1
    ? spark.map((v, i) => `${((i / (spark.length - 1)) * 96 + 2).toFixed(1)},${(22 - Math.max(0, Math.min(1, v)) * 20).toFixed(1)}`).join(' ')
    : '';

  // count the number up to its value - the measurement feels earned, not pasted in
  const display = tweened(rating ?? 0, { duration: 600, easing: cubicOut });
  $: if (rating != null) display.set(rating);
  $: shownRating = Math.round($display);

  $: tag = href ? 'a' : 'div';
  $: cls = href ? 'panel block p-5 transition-colors hover:border-accent/60' : 'panel block p-5';
</script>

<svelte:element this={tag} href={href || undefined} class={cls}>
  <span class="mb-3 flex items-baseline justify-between">
    <span class="label">{label}</span>
    {#if provisional && rating != null}
      <span class="label text-accent">provisional</span>
    {/if}
  </span>

  {#if rating != null}
    <span class="flex items-baseline gap-3">
      <span class="font-mono {big ? 'text-5xl' : 'text-3xl'} leading-none text-body">{shownRating}</span>
      {#if sem != null}
        <span class="font-mono text-xs text-muted">± {sem}</span>
      {/if}
      {#if sparkPoints}
        <svg viewBox="0 0 100 24" class="ml-auto h-5 w-16 shrink-0 opacity-80" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={sparkPoints} fill="none" stroke="rgb(var(--c-accent))" stroke-width="1.5" />
        </svg>
      {/if}
      {#if delta != null && delta !== 0}
        <span class="font-mono text-sm {delta > 0 ? 'text-ok' : 'text-bad'}">
          {delta > 0 ? '+' : ''}{delta}<span class="text-muted"> 7d</span>
        </span>
      {/if}
    </span>

    {#if sem != null}
      <span class="relative mt-2 block h-1 w-full" title="± standard error, drawn on a fixed ±{SEM_AXIS} scale">
        <span class="absolute inset-y-0 left-0 block w-full bg-edge/60"></span>
        <span class="absolute inset-y-0 block bg-accent/50" style="left: {50 - semPct / 2}%; width: {semPct}%"></span>
        <span class="absolute inset-y-0 block w-px bg-accent" style="left: 50%"></span>
      </span>
    {/if}

    <span class="mt-4 block space-y-2">
      {#if status === 'ok' && percentile != null}
        <span class="block h-px w-full bg-edge">
          <span class="block h-px bg-accent" style="width: {percentile}%"></span>
        </span>
        <span class="block text-xs text-muted">
          <span class="text-accent">{ordinal(percentile)} percentile</span> · higher than {percentile}% of rated users
        </span>
      {:else}
        <span class="block h-px w-full bg-edge"></span>
        <span class="block text-xs text-muted">
          Calibrating - percentile unlocks once enough people are rated{poolSize != null ? ` (pool: ${poolSize})` : ''}
        </span>
      {/if}
      {#if provisional}
        <span class="block text-xs text-muted">Keep practicing to firm up this rating.</span>
      {/if}
    </span>
  {:else}
    <span class="font-mono {big ? 'text-5xl' : 'text-3xl'} block leading-none text-edge">---</span>
    <span class="mt-4 block text-xs text-muted">No measurements yet</span>
  {/if}
</svelte:element>
