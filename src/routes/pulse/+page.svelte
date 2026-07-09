<script lang="ts">
  export let data;
</script>

<svelte:head>
  <title>Daily pulse - Excogni</title>
  <meta name="description" content="Ninety seconds. Three items. A stream, not a snapshot." />
</svelte:head>

<div class="mx-auto flex max-w-md flex-col items-center gap-8 px-4 py-14 text-center">
  <div>
    <p class="label mb-2">Daily pulse</p>
    <h1 class="text-2xl font-light">Ninety seconds. Three items.</h1>
  </div>

  <div class="panel flex w-full flex-col items-center gap-2 p-8">
    <p class="font-mono text-6xl">{data.daysPracticed}</p>
    <p class="label">days practiced</p>
    <p class="mt-2 max-w-xs text-xs text-muted">
      A count, not a streak. Missing a day breaks nothing - every day you show up is one more
      point in your stream.
    </p>
  </div>

  {#if data.weather}
    <p class="max-w-sm text-sm text-muted" title={data.weather.detail}>{data.weather.line}</p>
  {/if}

  {#if data.todayDone}
    <p class="text-sm text-muted">Today's pulse is done. Come back tomorrow, or take a full session.</p>
    <div class="flex flex-wrap justify-center gap-3">
      <a class="btn-primary" href="/stats">See your stream</a>
      <a class="btn" href="/practice/run">Full session</a>
    </div>
  {:else}
    <a class="btn-primary px-8 py-3 text-lg" href="/practice/run?pulse=1&skipintro=1">Start today's pulse</a>
    <p class="text-xs text-muted">Three adaptive items from your faculties. No timer pressure beyond the tasks themselves.</p>
  {/if}
</div>
