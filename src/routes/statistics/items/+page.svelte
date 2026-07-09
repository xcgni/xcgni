<script lang="ts">
  export let data;
  const pretty = (s: string) => s.replace(/_/g, ' ');
</script>

<svelte:head>
  <title>Item statistics - Excogni</title>
  <meta name="description" content="Classical test theory per challenge: difficulty, discrimination, and sample size, published openly. Items below the reporting threshold are withheld as a count." />
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
  <div>
    <p class="label mb-1"><a href="/statistics" class="hover:text-body">Statistics</a> · Items</p>
    <h1 class="text-2xl font-light">Item statistics</h1>
    <p class="mt-2 text-sm text-muted">
      Classical test theory for every challenge with enough data: difficulty (proportion
      correct), discrimination (point-biserial against the answerer's own category accuracy -
      an approximation, since the item is inside its own reference mean; stated rather than
      hidden), sample size, and median response time. Consented attempts only. Items under
      n={data.minN} are withheld as a count below. Content is never shown here - statistics
      about items, not the items themselves.
    </p>
    {#if data.preview}
      <p class="mt-2 rounded border border-accent/40 bg-accent/10 p-2 text-xs text-accent">
        Preview - includes simulated data while the real pool grows.
      </p>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-1 text-xs">
    <a href="/statistics/items" class="px-2 py-1 {data.category == null ? 'text-accent' : 'text-muted hover:text-body'}">all</a>
    {#each data.categories as c (c)}
      <a href="/statistics/items?category={c}" class="px-2 py-1 {data.category === c ? 'text-accent' : 'text-muted hover:text-body'}">{pretty(c)}</a>
    {/each}
  </div>

  {#if data.items.length === 0}
    <div class="panel p-5">
      <p class="text-sm text-muted">
        Nothing clears the n={data.minN} reporting threshold here yet
        {#if data.withheld > 0}({data.withheld} item{data.withheld === 1 ? '' : 's'} withheld below it){/if}.
        This table fills in as the pool practices.
      </p>
    </div>
  {:else}
    <div class="panel overflow-x-auto p-0">
      <table class="w-full text-left font-mono text-xs">
        <thead>
          <tr class="border-b border-edge text-muted">
            <th class="p-2 font-normal">item</th>
            <th class="p-2 font-normal">type</th>
            <th class="p-2 text-right font-normal">lvl</th>
            <th class="p-2 text-right font-normal" title="attempts">n</th>
            <th class="p-2 text-right font-normal" title="proportion correct">diff</th>
            <th class="p-2 text-right font-normal" title="point-biserial vs the answerer's category accuracy">disc</th>
            <th class="p-2 text-right font-normal" title="median response, ms">med ms</th>
          </tr>
        </thead>
        <tbody>
          {#each data.items as it (it.bankKey)}
            <tr class="border-b border-edge/40">
              <td class="p-2 text-body">{it.bankKey}</td>
              <td class="p-2 text-muted">{pretty(it.challengeType)}</td>
              <td class="p-2 text-right text-muted">{it.level}</td>
              <td class="p-2 text-right text-muted">{it.n}</td>
              <td class="p-2 text-right {it.difficulty < 0.2 || it.difficulty > 0.95 ? 'text-accent' : 'text-body'}">{it.difficulty.toFixed(2)}</td>
              <td class="p-2 text-right {it.discrimination != null && it.discrimination < 0.1 ? 'text-accent' : 'text-body'}">{it.discrimination == null ? '·' : it.discrimination.toFixed(2)}</td>
              <td class="p-2 text-right text-muted">{it.medianMs ?? '·'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted">
      {data.items.length} item{data.items.length === 1 ? '' : 's'} shown
      {#if data.withheld > 0}· {data.withheld} withheld below n={data.minN}{/if}
      · {data.totalAttempts} consented attempts behind this table.
      Accent marks flag items worth an editor's eye: extreme difficulty or near-zero
      discrimination. The bank is data - these numbers are how it gets better.
    </p>
  {/if}
</div>
