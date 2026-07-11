<script lang="ts">
  import { t } from '$lib/i18n/store';
  import { goto } from '$app/navigation';
  import TrendsChart from '$lib/components/TrendsChart.svelte';
  import QuantileStrip from '$lib/components/QuantileStrip.svelte';
  export let data;
  $: s = data.stats;

  // scale the distribution bars to the tallest bin
  $: maxCount = s.distribution.length ? Math.max(...s.distribution.map((d) => d.count)) : 0;
  $: distMin = s.distribution.length ? s.distribution[0].rating : 0;
  $: distMax = s.distribution.length ? s.distribution[s.distribution.length - 1].rating + 50 : 0;
  $: distPct = (v: number) => distMax > distMin ? ((v - distMin) / (distMax - distMin)) * 100 : 0;

  // shared axis for a set of quantile strips: cover every band + the reference, snap to 50s
  function axis(rows: { median: number | null; q1: number | null; q3: number | null }[], ref: number | null) {
    const vals: number[] = [];
    for (const r of rows) for (const v of [r.median, r.q1, r.q3]) if (v != null) vals.push(v);
    if (ref != null) vals.push(ref);
    if (!vals.length) return { min: 0, max: 100 };
    const lo = Math.floor((Math.min(...vals) - 40) / 50) * 50;
    const hi = Math.ceil((Math.max(...vals) + 40) / 50) * 50;
    return { min: lo, max: hi };
  }

  // categories, as strips: sorted by median (rated first), axis shared with population median
  $: catRows = [...s.categories].sort((a, b) => (b.medianRating ?? -1) - (a.medianRating ?? -1));
  $: catAxis = axis(catRows.map((c) => ({ median: c.medianRating, q1: c.q1, q3: c.q3 })), s.overall?.median ?? null);

  // explore: the reference respects the skill scope - population median overall, or the
  // selected category's own population median when one skill is in focus
  $: exploreRef = data.category
    ? (s.categories.find((c) => c.slug === data.category)?.medianRating ?? null)
    : (s.overall?.median ?? null);
  type SortKey = 'median' | 'n' | 'name';
  let sortBy: SortKey = 'median';
  const sortOptions: { key: SortKey; lbl: string }[] = [
    { key: 'median', lbl: 'median' }, { key: 'n', lbl: 'group size' }, { key: 'name', lbl: 'A-Z' }
  ];
  $: exploreRows = [...data.explore.rows].sort((a, b) =>
    sortBy === 'n' ? b.n - a.n
    : sortBy === 'name' ? a.group.localeCompare(b.group)
    : (b.medianRating ?? -1) - (a.medianRating ?? -1));
  $: exploreAxis = axis(data.explore.rows.map((r) => ({ median: r.medianRating, q1: r.q1, q3: r.q3 })), exploreRef);

  $: bibtex = `@misc{excogni_stats,
  title  = {Excogni population statistics (methodology m1)},
  author = {{Excogni contributors}},
  url    = {https://xcgni.com/statistics},
  note   = {Aggregate, consented, k-anonymous (k >= ${data.explore.minCell}). Retrieved: add your access date.}
}`;

  // Drill-down: clicking a group pins it as a filter and rotates group-by to the next
  // free dimension - "group by country, click Croatia, now compare Croatian age bands".
  // 'unknown' is the COALESCE bucket, not a real attribute value, so it isn't clickable.
  function drillHref(group: string): string | null {
    if (group === 'unknown') return null;
    if (!(data.dimValues[data.groupBy] ?? []).includes(group)) return null;
    const nextBy = data.dims.find((d) =>
      d !== data.groupBy && !data.filters.some((f) => f.dimension === d));
    if (!nextBy) return null;
    const p = new URLSearchParams();
    p.set('by', nextBy);
    if (data.category) p.set('category', data.category);
    for (const f of data.filters) p.append('f', `${f.dimension}:${f.value}`);
    p.append('f', `${data.groupBy}:${group}`);
    return '/statistics?' + p.toString();
  }

  // --- explorer controls ---
  let addDim = '';
  let addVal = '';

  // Build a /statistics query string from the current view, with optional mutations.
  // Keeps group-by, skill, and active filters; lets us add/remove filters as shareable URLs.
  function buildQuery(opts: { removeFilter?: string; clearFilters?: boolean; addFilter?: string }): string {
    const p = new URLSearchParams();
    if (data.groupBy) p.set('by', data.groupBy);
    if (data.category) p.set('category', data.category);
    if (!opts.clearFilters) {
      for (const f of data.filters) {
        const key = `${f.dimension}:${f.value}`;
        if (opts.removeFilter && key === opts.removeFilter) continue;
        p.append('f', key);
      }
    }
    if (opts.addFilter) p.append('f', opts.addFilter);
    return p.toString();
  }

  function addFilter(dim: string, val: string) {
    if (!dim || !val) return;
    addDim = '';
    addVal = '';
    goto('/statistics?' + buildQuery({ addFilter: `${dim}:${val}` }));
  }
</script>

<svelte:head><title>Population statistics - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 py-8 sm:gap-8 sm:py-10">
  <div class="flex flex-col gap-2">
    <p class="label text-accent">Global stats</p>
    <a href="/stats" class="label text-muted hover:text-body">{$t('s.backToStats')}</a>
    <h1 class="h-page">The aggregate picture</h1>
    <p class="max-w-2xl text-sm leading-relaxed text-muted">
      The population view, open to everyone - no account needed. Everything here is from
      people who consented to aggregate research, and any group too small to show without
      risking someone's anonymity is withheld. No individual is ever shown. This is the
      commons the project keeps free; how every number is computed is
      <a href="/methodology" class="text-accent hover:underline">published openly</a>.
      The pool also gives back:
      <a href="/statistics/findings" class="text-accent hover:underline">findings from the pool</a>
      and per-challenge
      <a href="/statistics/items" class="text-accent hover:underline">item statistics</a>.
    </p>
    <p class="max-w-2xl text-xs leading-relaxed text-muted">
      One caveat worth keeping in mind: these users are mostly people who actively seek out
      cognitive training, not a random cross-section of the population. Read the numbers as
      "this engaged community", not "humanity in general".
    </p>
  </div>

  {#if s.preview}
    <div class="panel border-accent/40 bg-accent/5 p-3">
      <p class="text-sm text-accent">Preview - includes simulated data</p>
      <p class="text-xs text-muted">This page is showing synthetic reference users so the layout and suppression logic can be demoed before real consented users exist. Not real population data.</p>
    </div>
  {/if}

  {#if !s.enoughData}
    <div class="panel flex flex-col gap-3 p-6">
      <p class="text-body">Not enough data yet to show a population picture.</p>
      <p class="text-sm leading-relaxed text-muted">
        Statistics appear once enough people have practised and consented to share
        anonymised results - at least {s.minCell} rated, consented users before anything
        is displayed. This page fills in as the community grows. (Showing nothing until
        it's safe to show something is the honest default, not a bug.)
      </p>
      {#if s.preview}
        <p class="text-xs text-accent">Preview mode is ON, but no consented rated users were found. Re-run the seed (ENABLE_SIMULATED_USERS=true) so simulated users get consent rows, then reload.</p>
      {:else}
        <p class="text-xs text-muted">Preview mode is OFF. Set STATS_PREVIEW=true (and rebuild) to demo this page with simulated data.</p>
      {/if}
    </div>
  {:else}
    <section class="panel flex flex-wrap items-end gap-x-10 gap-y-4 p-6">
      <div class="flex flex-col gap-1">
        <p class="label">Rated, consented users</p>
        <span class="font-mono text-4xl text-body">{s.ratedUsers?.toLocaleString()}</span>
      </div>
      {#if s.overall}
        <div class="flex flex-col gap-1">
          <p class="label">Median overall rating</p>
          <span class="font-mono text-4xl text-accent">{s.overall.median}</span>
        </div>
        {#if s.overall.iqr}
          <div class="flex flex-col gap-1">
            <p class="label">Middle 50%</p>
            <span class="font-mono text-2xl text-body">{s.overall.iqr[0]}-{s.overall.iqr[1]}</span>
          </div>
        {/if}
      {/if}
      {#if data.trends.enoughData && data.trends.totalUsers}
        <div class="flex flex-col gap-1">
          <p class="label">Total joined</p>
          <span class="font-mono text-2xl text-muted">{data.trends.totalUsers.toLocaleString()}</span>
        </div>
      {/if}
    </section>

    <!-- Community trends over time -->
    {#if data.trends.enoughData}
      <section class="flex flex-col gap-3">
        <p class="label">The community over time</p>
        <TrendsChart points={data.trends.points} />
      </section>
    {/if}

    {#if s.distribution.length > 0}
      <section class="flex flex-col gap-3">
        <p class="label">Overall rating distribution</p>
        <div class="panel p-5">
          <!-- Purely the population: this page shows no individual, including the viewer.
               Your own place on this curve lives on {$t('s.yourStats')}, with its full context. -->
          <div class="relative" style="height: 150px;">
            {#if s.overall?.iqr}
              <div class="absolute bottom-0 top-0 rounded-sm bg-accent/10"
                style="left: {distPct(s.overall.iqr[0])}%; width: {Math.max(0, distPct(s.overall.iqr[1]) - distPct(s.overall.iqr[0]))}%"></div>
            {/if}
            <div class="absolute inset-0 flex items-end gap-px">
              {#each s.distribution as bin}
                <div class="group relative flex h-full flex-1 items-end" title="{bin.rating}-{bin.rating + 50}: {bin.count} people">
                  <div class="w-full rounded-t-sm bg-accent/60 transition-colors group-hover:bg-accent"
                    style="height: {maxCount ? Math.max(2, (bin.count / maxCount) * 100) : 0}%"></div>
                </div>
              {/each}
            </div>
            {#if s.overall?.median != null}
              <div class="absolute bottom-0 top-0 w-px bg-body/70" style="left: {distPct(s.overall.median)}%"></div>
              <span class="absolute -top-1 -translate-x-1/2 font-mono text-[10px] text-body" style="left: {distPct(s.overall.median)}%">median {s.overall.median}</span>
            {/if}
            <span class="absolute bottom-0 left-0 right-0 h-px bg-edge"></span>
          </div>
          <div class="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
            <span>{distMin}</span>
            {#if s.overall?.iqr}<span>shaded: middle 50% ({s.overall.iqr[0]}-{s.overall.iqr[1]})</span>{/if}
            <span>{distMax}</span>
          </div>
          <p class="mt-3 text-xs text-muted">Each bar is a 50-point rating bin. Where you sit on this curve is on <a href="/stats" class="text-accent hover:underline">your stats</a>, with its full context.</p>
        </div>
      </section>
    {/if}

    <section class="flex flex-col gap-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="label">The faculties, side by side</p>
        <span class="font-mono text-[10px] text-muted">band = middle 50% · tick = median · dashed = population median</span>
      </div>
      <div class="panel p-4">
        <div class="mb-1 flex justify-between font-mono text-[10px] text-muted">
          <span>{catAxis.min}</span><span>rating</span><span>{catAxis.max}</span>
        </div>
        <div class="divide-y divide-edge/60">
          {#each catRows as c (c.slug)}
            <QuantileStrip
              label={c.name} href={`/about/${c.slug}`}
              median={c.medianRating} q1={c.q1} q3={c.q3} n={c.n}
              min={catAxis.min} max={catAxis.max}
              reference={s.overall?.median ?? null} />
          {/each}
        </div>
      </div>
      <p class="text-xs text-muted">Sorted by median. Each name links to that faculty's explainer. Categories below the anonymity floor are shown as withheld, not omitted - a gap is information too.</p>
    </section>

    <!-- Behavioural traits: a VISIBLY SEPARATE section, because persistence and spelling are
         self-determined behaviour, not measured cognition - a different kind of thing. -->
    {#if data.behavioral.persistenceUsers != null || data.behavioral.spellingUsers != null}
      <section class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <span class="h-px flex-1 bg-edge"></span>
          <p class="label text-muted">Behavioural traits (not cognition)</p>
          <span class="h-px flex-1 bg-edge"></span>
        </div>
        <p class="max-w-2xl text-sm text-muted">
          These describe how people <em>use</em> Excogni - showing up and typing - rather than how they
          perform cognitively. Kept separate on purpose: consistency and spelling are behaviour, not
          mental ability.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#if data.behavioral.persistenceUsers != null}
            <div class="panel p-4"><p class="label">Median active days</p><p class="font-mono text-2xl">{data.behavioral.medianActiveDays ?? '·'}</p><p class="text-xs text-muted">per person</p></div>
            <div class="panel p-4"><p class="label">Median (last 30)</p><p class="font-mono text-2xl">{data.behavioral.medianDaysLast30 ?? '·'}</p><p class="text-xs text-muted">days practised</p></div>
          {/if}
          {#if data.behavioral.spellingUsers != null}
            <div class="panel p-4"><p class="label">Median spelling</p><p class="font-mono text-2xl">{data.behavioral.medianSpellingPct == null ? '·' : data.behavioral.medianSpellingPct + '%'}</p><p class="text-xs text-muted">clean typed words</p></div>
            <div class="panel p-4"><p class="label">Spelling sample</p><p class="font-mono text-2xl">{data.behavioral.spellingUsers}</p><p class="text-xs text-muted">people (20+ words)</p></div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- The powerful explorer: group-by + stackable filters + optional category scope.
         Every final group below the floor (>=50) is withheld, however you slice it. -->
    <section class="flex flex-col gap-4">
      <p class="label">Global stats - explore</p>
      <p class="max-w-2xl text-sm text-muted">
        Slice the consented population any way you like: group by one dimension, narrow with
        filters, and focus on a single skill if you want. Clicking a group pins it as a filter
        and regroups by the next dimension - drill in as far as the data safely allows. Any
        group with fewer than {data.explore.minCell} people is never shown - so you can explore
        freely without any small group ever being exposed.
      </p>

      <!-- Controls: a GET form so every view is a shareable URL and works without JavaScript. -->
      <form method="GET" class="panel flex flex-col gap-4 p-4">
        <div class="flex flex-wrap items-end gap-4">
          <label class="flex flex-col gap-1 text-sm">
            <span class="label text-muted">Group by</span>
            <select name="by" class="rounded border border-edge bg-ink px-3 py-1.5 text-body">
              {#each data.dims as d}
                <option value={d} selected={data.groupBy === d}>{data.dimLabels[d]}</option>
              {/each}
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="label text-muted">Skill</span>
            <select name="category" class="rounded border border-edge bg-ink px-3 py-1.5 text-body">
              <option value="" selected={!data.category}>Overall</option>
              {#each data.categories as c}
                <option value={c.slug} selected={data.category === c.slug}>{c.name}</option>
              {/each}
            </select>
          </label>
        </div>

        <!-- existing filters as hidden inputs so they persist when changing group-by/skill -->
        {#each data.filters as f}
          <input type="hidden" name="f" value={`${f.dimension}:${f.value}`} />
        {/each}

        <!-- active filter chips -->
        {#if data.filters.length > 0}
          <div class="flex flex-wrap items-center gap-2">
            <span class="label text-muted">Filters:</span>
            {#each data.filters as f}
              <span class="inline-flex items-center gap-1.5 rounded border border-edge bg-ink px-2 py-1 text-xs">
                <span class="text-muted">{data.dimLabels[f.dimension]}:</span>
                <span class="text-body">{f.value}</span>
                <a
                  href={'/statistics?' + buildQuery({ removeFilter: `${f.dimension}:${f.value}` })}
                  class="text-muted hover:text-bad"
                  aria-label="remove filter"
                >×</a>
              </span>
            {/each}
            <a href={'/statistics?' + buildQuery({ clearFilters: true })} class="text-xs text-muted hover:text-body">clear all</a>
          </div>
        {/if}

        <div class="flex flex-wrap items-end gap-3 border-t border-edge pt-3">
          <span class="label text-muted">Add filter</span>
          <select name="addDim" class="rounded border border-edge bg-ink px-3 py-1.5 text-sm text-body" bind:value={addDim}>
            <option value="">choose dimension…</option>
            {#each data.dims as d}
              {#if d !== data.groupBy && !data.filters.some((f) => f.dimension === d)}
                <option value={d}>{data.dimLabels[d]}</option>
              {/if}
            {/each}
          </select>
          {#if addDim}
            <select name="addVal" class="rounded border border-edge bg-ink px-3 py-1.5 text-sm text-body" bind:value={addVal}>
              <option value="">choose value…</option>
              {#each data.dimValues[addDim] ?? [] as v}
                <option value={v}>{v}</option>
              {/each}
            </select>
            <button
              type="button"
              class="btn"
              disabled={!addVal}
              on:click={() => addFilter(addDim, addVal)}
            >Add</button>
          {/if}
          <button type="submit" class="btn-primary ml-auto">Apply</button>
        </div>
      </form>

      <!-- matched-population line (suppressed if the filtered total is itself below the floor) -->
      {#if data.filters.length > 0 || data.category}
        <p class="text-xs text-muted">
          {#if data.explore.totalMatched > 0}
            {data.explore.totalMatched} consented people match these filters.
          {:else}
            Too few people match these filters to show anything (floor {data.explore.minCell}).
          {/if}
        </p>
      {/if}

      {#if data.explore.rows.length === 0}
        <div class="panel p-5">
          <p class="text-sm text-muted">No group here is large enough to show yet (floor {data.explore.minCell}). Loosen the filters or come back as the community grows.</p>
        </div>
      {:else}
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1 text-xs">
            <span class="label text-muted">Sort:</span>
            {#each sortOptions as o (o.key)}
              <button type="button"
                class="rounded px-2 py-1 {sortBy === o.key ? 'bg-accent/15 text-accent' : 'text-muted hover:text-body'}"
                on:click={() => (sortBy = o.key)}>{o.lbl}</button>
            {/each}
          </div>
          <span class="font-mono text-[10px] text-muted">band = middle 50% · tick = median · dashed = {data.category ? 'this skill, everyone' : 'population median'}</span>
        </div>
        <div class="panel p-4">
          <div class="mb-1 flex justify-between font-mono text-[10px] text-muted">
            <span>{exploreAxis.min}</span><span>rating</span><span>{exploreAxis.max}</span>
          </div>
          <div class="divide-y divide-edge/60">
            {#each exploreRows as r (r.group)}
              <QuantileStrip
                label={r.group} href={drillHref(r.group)}
                median={r.medianRating} q1={r.q1} q3={r.q3} n={r.n}
                min={exploreAxis.min} max={exploreAxis.max}
                reference={exploreRef} />
            {/each}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <a href={'/statistics/export.csv?' + buildQuery({})} class="label text-accent hover:underline">Export CSV ↓</a>
          <a href={'/statistics/export.json?' + buildQuery({})} class="label text-accent hover:underline">Export JSON ↓</a>
          {#if data.explore.suppressedGroups > 0}
            <span class="text-xs text-muted">{data.explore.suppressedGroups} group{data.explore.suppressedGroups === 1 ? '' : 's'} withheld to protect small groups (floor {data.explore.minCell})</span>
          {/if}
        </div>
      {/if}
    </section>

  <section id="dataset" class="flex flex-col gap-3">
    <p class="label">For researchers - the dataset</p>
    <p class="text-sm leading-relaxed text-muted">
      The CSV/JSON exports above are a citable aggregate dataset: every slice of the consented
      pool, grouped by one demographic dimension, optionally filtered and skill-scoped. Schema
      per row: <span class="font-mono text-body">group, n, median_rating, q1, q3</span> - the
      group value, distinct consented users in it, and the median and quartiles of their
      current Excogni Ratings (see <a href="/methodology" class="text-accent hover:underline">methodology</a>
      for how a rating is computed; exports are stamped with the methodology version).
    </p>
    <p class="text-sm leading-relaxed text-muted">
      Collection conditions, stated plainly: self-selected volunteers on their own devices,
      unsupervised, web-based; ratings conflate ability with practice exposure; groups below
      {data.explore.minCell} are withheld, so published slices are truncated by design. Read the
      <a href="/methodology" class="text-accent hover:underline">limitations</a> before drawing
      conclusions. The instrument itself is open source (AGPL), so the full data-generating
      process is inspectable.
    </p>
    <div class="rounded border border-edge bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
      <p class="text-body">Cite as:</p>
      <pre class="whitespace-pre-wrap">{bibtex}</pre>
    </div>
  </section>

  {/if}

  <div class="flex gap-3 pt-2">
    <a href="/practice" class="btn-primary">Start practising</a>
    <a href="/methodology" class="btn">How it works</a>
  </div>
</div>
