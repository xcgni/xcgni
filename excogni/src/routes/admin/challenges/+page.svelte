<script lang="ts">
  export let data;
  export let form;

  // which challenge's edit drawer is open
  let editingId: string | null = form?.editId ?? null;
  let addOpen = !!form?.addOpen;

  // pretty-print JSON for the edit/add textareas
  function pretty(v: unknown): string {
    try { return JSON.stringify(v, null, 2); } catch { return '{}'; }
  }

  // build a query string for the filter form / pagination links
  function qs(overrides: Record<string, string | number | null>): string {
    const p = new URLSearchParams();
    const base: Record<string, string | number | null> = {
      cat: data.selected,
      level: data.list?.level ?? null,
      active: data.list?.activeOnly ? '1' : null,
      q: data.list?.search || null,
      p: data.list?.page ?? null,
      ...overrides
    };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== '' && v !== undefined) p.set(k, String(v));
    return '?' + p.toString();
  }

  $: selectedCat = data.overview.find((c) => c.slug === data.selected);
  $: totalPages = data.list ? Math.ceil(data.list.total / data.list.pageSize) : 0;

  // starter templates for the add form, by renderer
  const TEMPLATES: Record<string, { prompt: string; answer: string; scoring: string }> = {
    multiple_choice_text: {
      prompt: pretty({ instruction: 'Synonym of HAPPY', options: ['glad', 'tall', 'cold', 'fast'], language: 'en' }),
      answer: pretty({ correctAnswer: 0, acceptedAnswers: ['0'] }),
      scoring: pretty({ expectedMedianMs: 8000 })
    },
    numeric_text_input: {
      prompt: pretty({ expression: '12 + 7' }),
      answer: pretty({ correctAnswer: 19 }),
      scoring: pretty({ expectedMedianMs: 6000 })
    },
    planning_sequence: {
      prompt: pretty({ instruction: 'Start at 2. Reach 11.', start: 2, target: 11, allowed: ['+3', '*2', '-1'], hint: 'Type your steps, e.g. "*2, +3". No clock.' }),
      answer: pretty({ scoringMode: 'deliberate', start: 2, target: 11, allowed: ['+3', '*2', '-1'], optimalMoves: 3 }),
      scoring: pretty({ scoringMode: 'deliberate', expectedMedianMs: 30000, deliberate: true })
    },
    fluency_list: {
      prompt: pretty({ instruction: "Words starting with 'B'", timeMs: 30000, constraint: 'b' }),
      answer: pretty({ acceptList: ['ball', 'bat', 'bird'], constraint: 'b', scoringMode: 'fluency_count' }),
      scoring: pretty({ expectedMedianMs: 30000, fluency: true })
    }
  };
  let addRenderer = 'multiple_choice_text';
  $: addTemplate = TEMPLATES[addRenderer] ?? { prompt: '{\n  \n}', answer: '{\n  \n}', scoring: '{\n  "expectedMedianMs": 8000\n}' };
</script>

<svelte:head><title>Challenge manager - Admin</title></svelte:head>

<div class="flex flex-col gap-8">
  <div class="flex items-end justify-between gap-3">
    <div>
      <p class="label text-accent">Challenge manager</p>
      <h1 class="text-xl font-light">Enable, edit, and author challenges across categories.</h1>
      <p class="mt-1 text-xs text-muted">Experimental-tier challenges collect data but don't affect official ratings. Canonical ones are pinned by the current methodology.</p>
    </div>
    <button class="btn-primary text-sm" on:click={() => (addOpen = !addOpen)}>{addOpen ? 'Close' : '+ New challenge'}</button>
  </div>

  {#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
  {#if form?.added}<p class="text-sm text-ok">Challenge added.</p>{/if}
  {#if form?.edited}<p class="text-sm text-ok">Saved.</p>{/if}
  {#if form?.bulkToggled != null}<p class="text-sm text-ok">{form.bulkToggled} challenge{form.bulkToggled === 1 ? '' : 's'} updated.</p>{/if}

  <!-- ADD drawer -->
  {#if addOpen}
    <form method="POST" action="?/add" class="panel flex flex-col gap-3 border-l-2 border-l-accent p-5">
      <p class="label">New challenge</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label class="flex flex-col gap-1 text-xs text-muted">Category
          <select name="categorySlug" class="field text-sm">
            {#each data.categories as c}<option value={c.slug}>{c.name}</option>{/each}
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">Type
          <input name="challengeType" class="field text-sm" placeholder="e.g. synonym" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">Level
          <input name="level" type="number" min="1" max="20" value="1" class="field text-sm" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">Renderer
          <select name="rendererType" bind:value={addRenderer} class="field text-sm">
            {#each data.renderers as r}<option value={r}>{r}</option>{/each}
          </select>
        </label>
      </div>
      <label class="flex flex-col gap-1 text-xs text-muted">promptData (JSON)
        <textarea name="promptData" rows="5" class="field font-mono text-xs">{addTemplate.prompt}</textarea>
      </label>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-xs text-muted">answerData (JSON)
          <textarea name="answerData" rows="4" class="field font-mono text-xs">{addTemplate.answer}</textarea>
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">scoringConfig (JSON)
          <textarea name="scoringConfig" rows="4" class="field font-mono text-xs">{addTemplate.scoring}</textarea>
        </label>
      </div>
      <p class="text-xs text-muted">Tip: switch the renderer to load a matching template. New challenges are tagged <span class="font-mono">manual-…</span> so a re-seed won't clobber them.</p>
      <button class="btn-primary self-start text-sm">Create challenge</button>
    </form>
  {/if}

  <!-- OVERVIEW grid -->
  <section class="flex flex-col gap-3">
    <p class="label">Categories</p>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.overview as c}
        {@const pctActive = c.total > 0 ? Math.round((c.active / c.total) * 100) : 0}
        <a href={qs({ cat: c.slug, level: null, p: null })} data-sveltekit-noscroll
          class="panel flex flex-col gap-2 p-4 transition-colors hover:border-accent {data.selected === c.slug ? 'border-accent' : ''}">
          <div class="flex items-center justify-between">
            <span class="text-sm text-body">{c.name}</span>
            <span class="font-mono text-xs {c.active === c.total ? 'text-ok' : c.active === 0 ? 'text-bad' : 'text-accent'}">{c.active}/{c.total}</span>
          </div>
          <div class="h-1 w-full overflow-hidden rounded bg-edge">
            <div class="h-1 {pctActive === 100 ? 'bg-ok' : 'bg-accent'}" style="width: {pctActive}%"></div>
          </div>
          <span class="text-[10px] text-muted">{c.levels} level{c.levels === 1 ? '' : 's'}</span>
        </a>
      {/each}
    </div>
  </section>

  <!-- DETAIL list for the selected category -->
  {#if data.selected && data.list && selectedCat}
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="label">{selectedCat.name}</p>
          <p class="text-xs text-muted">{data.list.total} challenge{data.list.total === 1 ? '' : 's'} match</p>
        </div>
        <!-- bulk enable/disable -->
        <div class="flex gap-2">
          <form method="POST" action="?/bulkToggle">
            <input type="hidden" name="category" value={data.selected} />
            {#if data.list.level != null}<input type="hidden" name="level" value={data.list.level} />{/if}
            <input type="hidden" name="active" value="true" />
            <button class="btn text-xs">Enable all{data.list.level != null ? ` L${data.list.level}` : ''}</button>
          </form>
          <form method="POST" action="?/bulkToggle">
            <input type="hidden" name="category" value={data.selected} />
            {#if data.list.level != null}<input type="hidden" name="level" value={data.list.level} />{/if}
            <input type="hidden" name="active" value="false" />
            <button class="btn text-xs text-muted hover:text-bad">Disable all{data.list.level != null ? ` L${data.list.level}` : ''}</button>
          </form>
        </div>
      </div>

      <!-- filters -->
      <form method="GET" class="flex flex-wrap items-end gap-2">
        <input type="hidden" name="cat" value={data.selected} />
        <label class="flex flex-col gap-1 text-xs text-muted">Level
          <input name="level" type="number" min="1" max="20" value={data.list.level ?? ''} placeholder="all" class="field w-20 text-sm" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">Search
          <input name="q" value={data.list.search} placeholder="bankKey or prompt text" class="field text-sm" />
        </label>
        <label class="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="active" value="1" checked={data.list.activeOnly} class="h-4 w-4 accent-[rgb(var(--c-accent))]" /> active only
        </label>
        <button class="btn text-xs">Filter</button>
      </form>

      <!-- the list -->
      <div class="flex flex-col divide-y divide-edge overflow-hidden rounded border border-edge">
        {#each data.list.rows as ch}
          <div class="flex flex-col gap-2 bg-ink p-3">
            <div class="flex items-center gap-3">
              <span class="font-mono text-[10px] {ch.active ? 'text-ok' : 'text-bad'}">{ch.active ? '●' : '○'}</span>
              <span class="w-10 shrink-0 font-mono text-xs text-muted">L{ch.level}</span>
              <span class="shrink-0 rounded bg-edge px-1.5 py-0.5 text-[10px] text-muted">{ch.challengeType}</span>
              {#if ch.tier === 'experimental'}
                <span class="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent" title="collects data but does not affect official ratings">experimental</span>
              {/if}
              <span class="flex-1 truncate text-xs text-body">{(ch.promptData?.instruction ?? ch.promptData?.expression ?? ch.bankKey ?? ch.id)}</span>
              <form method="POST" action="?/tier" class="shrink-0">
                <input type="hidden" name="id" value={ch.id} />
                <input type="hidden" name="tier" value={ch.tier === 'experimental' ? 'canonical' : 'experimental'} />
                <button class="text-[11px] text-muted hover:text-accent" title="toggle canonical/experimental">{ch.tier === 'experimental' ? '→canon' : '→exp'}</button>
              </form>
              <button class="text-[11px] text-muted hover:text-body" on:click={() => (editingId = editingId === ch.id ? null : ch.id)}>{editingId === ch.id ? 'close' : 'edit'}</button>
              <form method="POST" action="?/toggle" class="shrink-0">
                <input type="hidden" name="id" value={ch.id} />
                <input type="hidden" name="active" value={(!ch.active).toString()} />
                <button class="text-[11px] {ch.active ? 'text-muted hover:text-bad' : 'text-ok hover:underline'}">{ch.active ? 'disable' : 'enable'}</button>
              </form>
            </div>

            {#if editingId === ch.id}
              <form method="POST" action="?/edit" class="mt-1 flex flex-col gap-2 border-t border-edge pt-3">
                <input type="hidden" name="id" value={ch.id} />
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label class="flex flex-col gap-1 text-[10px] text-muted">Type
                    <input name="challengeType" value={ch.challengeType} class="field text-xs" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] text-muted">Level
                    <input name="level" type="number" min="1" max="20" value={ch.level} class="field text-xs" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] text-muted">Renderer
                    <select name="rendererType" class="field text-xs">
                      {#each data.renderers as r}<option value={r} selected={r === ch.rendererType}>{r}</option>{/each}
                    </select>
                  </label>
                </div>
                <label class="flex flex-col gap-1 text-[10px] text-muted">promptData
                  <textarea name="promptData" rows="4" class="field font-mono text-[11px]">{pretty(ch.promptData)}</textarea>
                </label>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-[10px] text-muted">answerData
                    <textarea name="answerData" rows="3" class="field font-mono text-[11px]">{pretty(ch.answerData)}</textarea>
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] text-muted">scoringConfig
                    <textarea name="scoringConfig" rows="3" class="field font-mono text-[11px]">{pretty(ch.scoringConfig)}</textarea>
                  </label>
                </div>
                <div class="flex items-center gap-3">
                  <button class="btn-primary text-xs">Save changes</button>
                  <span class="font-mono text-[10px] text-muted">{ch.bankKey ?? ch.id} · v{ch.version}</span>
                  {#if ch.bankKey && !ch.bankKey.startsWith('manual-')}
                    <span class="text-[10px] text-accent">⚠ seeded - a re-seed will overwrite edits here</span>
                  {/if}
                </div>
              </form>
            {/if}
          </div>
        {/each}
        {#if data.list.rows.length === 0}
          <p class="bg-ink p-4 text-center text-xs text-muted">No challenges match these filters.</p>
        {/if}
      </div>

      <!-- pagination -->
      {#if totalPages > 1}
        <div class="flex items-center justify-center gap-3 text-xs">
          {#if data.list.page > 0}<a href={qs({ p: data.list.page - 1 })} class="text-accent hover:underline">← prev</a>{/if}
          <span class="text-muted">page {data.list.page + 1} / {totalPages}</span>
          {#if data.list.page < totalPages - 1}<a href={qs({ p: data.list.page + 1 })} class="text-accent hover:underline">next →</a>{/if}
        </div>
      {/if}
    </section>
  {:else}
    <p class="text-sm text-muted">Pick a category above to view and manage its challenges.</p>
  {/if}
</div>
