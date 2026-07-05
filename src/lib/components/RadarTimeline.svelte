<script lang="ts">
  import RadarChart from './RadarChart.svelte';

  // The current domains (for labels/status/members metadata) and the historical snapshots
  // (date + per-domain rating). The slider picks a snapshot; we project its ratings onto the
  // current domain metadata so the radar renders that point in time.
  export let domains: {
    domain: string; label: string; rating: number | null;
    status: 'ok' | 'partial' | 'unrated'; members: number; ratedMembers: number;
  }[] = [];
  export let snapshots: { date: string; domains: { domain: string; rating: number | null }[] }[] = [];
  export let population: { domain: string; median: number | null }[] = [];

  let idx = 0;
  $: maxIdx = Math.max(0, snapshots.length - 1);
  // default to the latest snapshot once data arrives
  $: if (snapshots.length > 0 && idx === 0 && !touched) idx = maxIdx;
  let touched = false;

  // project the selected snapshot's ratings onto current domain metadata
  $: selected = snapshots[Math.min(idx, maxIdx)] ?? null;
  $: snapByDomain = new Map((selected?.domains ?? []).map((d) => [d.domain, d.rating]));
  // When scrubbed to the LATEST frame, render the live domain values verbatim (same source as the
  // main radar above) so the two shapes are guaranteed identical at "now". Earlier frames use the
  // historical reconstruction. This removes the confusing now-vs-now mismatch.
  $: atLatest = idx >= maxIdx;
  $: projected = atLatest
    ? domains.map((d) => ({ ...d }))
    : domains.map((d) => ({
        ...d,
        rating: snapByDomain.has(d.domain) ? (snapByDomain.get(d.domain) ?? null) : null,
        status: snapByDomain.get(d.domain) != null ? ('ok' as const) : ('unrated' as const)
      }));

  $: prettyDate = selected
    ? new Date(selected.date + 'T00:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '';
  $: isLatest = idx >= maxIdx;

  // play / pause animation through the snapshots
  let playing = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  function togglePlay() {
    touched = true;
    if (playing) { stop(); return; }
    if (idx >= maxIdx) idx = 0; // restart from the beginning
    playing = true;
    timer = setInterval(() => {
      if (idx >= maxIdx) { stop(); return; }
      idx += 1;
    }, 700);
  }
  function stop() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
  }
  function onSlide(e: Event) {
    touched = true;
    stop();
    idx = Number((e.target as HTMLInputElement).value);
  }
</script>

{#if snapshots.length >= 2}
  <div class="flex flex-col gap-3">
    <RadarChart domains={projected} population={population} />

    <div class="flex items-center gap-3">
      <button
        type="button"
        on:click={togglePlay}
        class="shrink-0 rounded border border-edge px-3 py-1 text-xs text-muted hover:text-body"
        aria-label={playing ? 'Pause' : 'Play through time'}
      >{playing ? '❚❚ Pause' : '▶ Play'}</button>

      <input
        type="range"
        min="0"
        max={maxIdx}
        value={idx}
        on:input={onSlide}
        class="h-1 flex-1 cursor-pointer appearance-none rounded bg-edge accent-accent"
        aria-label="Scrub through your history"
      />

      <span class="shrink-0 font-mono text-xs {isLatest ? 'text-accent' : 'text-muted'}">
        {isLatest ? 'now' : prettyDate}
      </span>
    </div>

    <p class="text-center text-xs text-muted">
      Drag to watch your shape change over time{snapshots.length ? ` · ${snapshots.length} snapshots` : ''}.
      This is your own progression - the same population reference stays fixed behind it.
    </p>
  </div>
{:else}
  <!-- not enough history yet: just the current radar -->
  <RadarChart {domains} {population} />
  <p class="mt-1 text-center text-xs text-muted">
    Your radar will gain a time slider once you have a longer history - come back after a few more days of practice.
  </p>
{/if}
