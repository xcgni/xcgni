<script lang="ts">
  import { enhance } from '$app/forms';
  import CircleRadar from '$lib/components/CircleRadar.svelte';
  export let data;
  export let form;

  // head-to-head: pick two members who share ratings
  let h2hA = '';
  let h2hB = '';
  $: ratingMembers = data.stats?.members ?? [];
  $: if (ratingMembers.length >= 2 && !h2hA) { h2hA = ratingMembers.find((m) => m.isYou)?.displayName ?? ratingMembers[0].displayName; h2hB = ratingMembers.find((m) => m.displayName !== h2hA)?.displayName ?? ratingMembers[1].displayName; }
  $: memA = ratingMembers.find((m) => m.displayName === h2hA) ?? null;
  $: memB = ratingMembers.find((m) => m.displayName === h2hB) ?? null;

  // category picker state for "create" (and the admin focus editor)
  let picked = new Set<string>();
  function toggle(slug: string) {
    if (picked.has(slug)) picked.delete(slug);
    else picked.add(slug);
    picked = picked;
  }

  // admin focus editor mirrors the circle's current categories
  let focusEdit = new Set<string>();
  $: if (data.view) focusEdit = new Set(data.view.categories);
  function toggleFocus(slug: string) {
    if (focusEdit.has(slug)) focusEdit.delete(slug);
    else focusEdit.add(slug);
    focusEdit = focusEdit;
  }

  function catName(slug: string): string {
    return data.allCategories.find((c) => c.slug === slug)?.name ?? slug;
  }
</script>

<svelte:head><title>Experimental - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 py-6 sm:gap-8 sm:py-8">
  <div class="flex flex-col gap-2">
    <p class="label text-accent">Experimental · practice circles</p>
    <h1 class="text-2xl font-light">Practice alongside friends.</h1>
    <p class="text-sm leading-relaxed text-muted">
      Share a code, and a small private circle can see each other's practice. It's about showing up
      together - consistency and company - not ranking who's "smarter". You choose what you share, and
      ratings stay hidden unless you opt in. You can be in as many circles as you like.
    </p>
    <div class="panel border-l-2 border-l-accent/40 p-3 text-xs leading-relaxed text-muted">
      This is an <span class="text-body">experimental, fully optional</span> feature. Your data is
      already collected for your own and the global stats regardless - circles just present it among
      friends. You get the complete Excogni experience without ever joining one, and nothing here
      changes how you're measured.
    </div>
  </div>

  {#if !data.enabled}
    <div class="panel p-5 text-sm text-muted">
      Practice circles aren't enabled on this instance.
    </div>
  {:else if !data.signedIn}
    <div class="panel p-5 text-sm text-muted">
      <a href="/auth/login" class="text-accent hover:underline">Sign in</a> to create or join a circle
      (circles need an account so your friends can recognise you across visits).
    </div>
  {:else}
    {#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
    {#if form?.created}<p class="text-sm text-ok">Circle created. Share this code: <span class="font-mono text-accent">{form.created}</span></p>{/if}

    {#if data.view}
      <section class="flex flex-col gap-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="label">Circle{#if data.view.isAdmin} <span class="text-accent">· you created this</span>{/if}</p>
            <h2 class="text-xl">{data.view.name}</h2>
          </div>
          <div class="text-right">
            <p class="label">Join code</p>
            <p class="font-mono text-lg text-accent">{data.view.code}</p>
          </div>
        </div>

        <!-- the circle's shared focus -->
        {#if data.view.categories.length > 0}
          <div class="panel flex flex-col gap-3 p-4">
            <p class="label">Practice this circle's focus</p>
            <p class="text-xs text-muted">Start with the circle's focus areas. Your runs are normal practice - the circle just lets you see each other showing up. Suggested, never forced.</p>
            <a href="/practice/run?category={data.view.categories[0]}" class="btn-primary self-start text-sm">
              Start a focus session →
            </a>
            {#if data.view.categories.length > 1}
              <div class="flex flex-wrap gap-2 border-t border-edge pt-3">
                <span class="label w-full">Or pick one focus area</span>
                {#each data.view.categories as slug}
                  <a href="/practice/run?category={slug}" class="btn text-xs">{catName(slug)} →</a>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <div class="panel flex flex-col gap-2 p-4">
            <p class="label">No shared focus yet</p>
            <p class="text-xs text-muted">This circle hasn't set focus areas. You can still <a href="/practice" class="text-accent hover:underline">practise anything</a> - your activity shows up for the circle either way.</p>
          </div>
        {/if}

        <div class="panel flex items-center justify-between p-4">
          <p class="text-sm text-muted">Together this circle has practised</p>
          <p class="font-mono text-2xl text-accent">{data.view.totalAttempts.toLocaleString()}<span class="ml-1 text-xs text-muted">problems</span></p>
        </div>

        <!-- circle radar: median reference + member overlays -->
        {#if data.stats && data.stats.domainLabels.length >= 3}
          <div class="panel flex flex-col gap-2 p-4">
            <p class="label">Circle radar</p>
            <CircleRadar domainLabels={data.stats.domainLabels} median={data.stats.median} members={data.stats.members} />
          </div>
        {/if}

        <!-- superlatives -->
        {#if data.stats && data.stats.superlatives.length > 0}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {#each data.stats.superlatives as sup}
              <div class="panel p-4">
                <p class="label">{sup.label}</p>
                <p class="text-lg text-body">{sup.who}</p>
                <p class="text-xs text-muted">{sup.detail}</p>
              </div>
            {/each}
          </div>
        {/if}

        <!-- your rank within the circle -->
        {#if data.stats && data.stats.youPercentiles.some((p) => p.rank != null)}
          <div class="panel flex flex-col gap-2 p-4">
            <p class="label">Where you rank in this circle</p>
            <div class="flex flex-wrap gap-2">
              {#each data.stats.youPercentiles as p}
                {#if p.rank != null}
                  <span class="rounded border border-edge px-2 py-1 text-xs text-muted">
                    {p.label}: <span class="font-mono text-accent">#{p.rank}</span> of {p.of + 1}
                  </span>
                {/if}
              {/each}
            </div>
            <p class="text-xs text-muted">Among members who share ratings. Friendly, not a verdict.</p>
          </div>
        {/if}

        <!-- head-to-head compare -->
        {#if ratingMembers.length >= 2}
          <div class="panel flex flex-col gap-3 p-4">
            <p class="label">Head to head</p>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <select bind:value={h2hA} class="field w-auto">
                {#each ratingMembers as m}<option value={m.displayName}>{m.displayName}{m.isYou ? ' (you)' : ''}</option>{/each}
              </select>
              <span class="text-muted">vs</span>
              <select bind:value={h2hB} class="field w-auto">
                {#each ratingMembers as m}<option value={m.displayName}>{m.displayName}{m.isYou ? ' (you)' : ''}</option>{/each}
              </select>
            </div>
            {#if memA && memB && data.stats}
              <div class="flex flex-col gap-1">
                {#each data.stats.domainLabels as dl}
                  {@const a = memA.domains.find((d) => d.domain === dl.domain)?.rating ?? null}
                  {@const b = memB.domains.find((d) => d.domain === dl.domain)?.rating ?? null}
                  <div class="flex items-center gap-2 text-xs">
                    <span class="w-12 text-right font-mono {a != null && b != null && a > b ? 'text-ok' : 'text-muted'}">{a ?? '·'}</span>
                    <span class="flex-1 text-center text-muted">{dl.label}</span>
                    <span class="w-12 font-mono {a != null && b != null && b > a ? 'text-ok' : 'text-muted'}">{b ?? '·'}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {#each data.view.members as m}
            <div class="panel flex flex-col gap-2 p-4 {m.isYou ? 'border-accent/50' : ''}">
              <div class="flex items-center justify-between">
                <p class="text-body">{m.displayName}{#if m.isYou} <span class="text-xs text-accent">(you)</span>{/if}</p>
                {#if m.currentRun != null && m.currentRun > 0}
                  <span class="font-mono text-sm text-ok">{m.currentRun}d streak</span>
                {/if}
              </div>
              {#if m.daysLast30 != null}
                <div class="flex gap-4 font-mono text-sm">
                  <span class="text-body">{m.daysLast30}<span class="ml-1 text-xs text-muted">days/30</span></span>
                  {#if m.attempts != null}<span class="text-body">{m.attempts.toLocaleString()}<span class="ml-1 text-xs text-muted">total</span></span>{/if}
                  {#if m.rating != null}<span class="text-accent">{m.rating}<span class="ml-1 text-xs text-muted">rating</span></span>{/if}
                </div>
              {:else}
                <p class="text-xs text-muted">Keeps their activity private.</p>
              {/if}
            </div>
          {/each}
        </div>

        <!-- creator-only: edit the circle's focus -->
        {#if data.view.isAdmin}
          <form method="POST" action="?/categories" use:enhance class="panel flex flex-col gap-3 p-4">
            <input type="hidden" name="circle_id" value={data.view.id} />
            <p class="label">Set this circle's focus (you created it)</p>
            <div class="flex flex-wrap gap-2">
              {#each data.allCategories as cat}
                <label class="cursor-pointer rounded border px-2 py-1 text-xs transition-colors {focusEdit.has(cat.slug) ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}">
                  <input type="checkbox" name="categories" value={cat.slug} checked={focusEdit.has(cat.slug)} on:change={() => toggleFocus(cat.slug)} class="hidden" />
                  {cat.name}
                </label>
              {/each}
            </div>
            <button class="btn self-start text-sm">Save focus</button>
            {#if form?.focusSaved}<p class="text-xs text-ok">Focus saved.</p>{/if}
          </form>
        {/if}

        <!-- your sharing controls for this circle -->
        <form method="POST" action="?/sharing" use:enhance class="panel flex flex-col gap-3 p-4">
          <input type="hidden" name="circle_id" value={data.view.id} />
          <p class="label">What you share here</p>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="share_activity" class="h-4 w-4 accent-[rgb(var(--c-accent))]" checked={data.view.members.find((m) => m.isYou)?.shareActivity ?? true} />
            Activity &amp; streak (days practised, totals)
          </label>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" name="share_ratings" class="h-4 w-4 accent-[rgb(var(--c-accent))]" checked={data.view.members.find((m) => m.isYou)?.shareRatings ?? false} />
            My cognitive rating (off by default)
          </label>
          <button class="btn self-start text-sm">Save sharing</button>
          {#if form?.sharingSaved}<p class="text-xs text-ok">Saved.</p>{/if}
        </form>

        <form method="POST" action="?/leave" use:enhance>
          <input type="hidden" name="circle_id" value={data.view.id} />
          <button class="text-xs text-muted hover:text-bad">Leave this circle</button>
        </form>
      </section>
      <hr class="border-edge" />
    {/if}

    {#if data.circles.length > 0}
      <section class="flex flex-col gap-2">
        <p class="label">Your circles</p>
        <div class="flex flex-col gap-2">
          {#each data.circles as c}
            <a href="/circles?c={c.id}" class="panel flex items-center justify-between p-3 hover:border-accent">
              <span class="text-body">{c.name}</span>
              <span class="text-xs text-muted">{c.members} member{c.members === 1 ? '' : 's'} · <span class="font-mono text-accent">{c.code}</span></span>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- create, with focus picker -->
      <form method="POST" action="?/create" use:enhance class="panel flex flex-col gap-3 p-4">
        <p class="label">Start a circle</p>
        <input name="name" type="text" class="field" placeholder="Circle name (e.g. Friday Brains)" maxlength="60" />
        <input name="display_name" type="text" class="field" placeholder="Your name in the circle" maxlength="40" required />
        <p class="text-xs text-muted">Optional focus - areas your circle works on:</p>
        <div class="flex flex-wrap gap-2">
          {#each data.allCategories as cat}
            <label class="cursor-pointer rounded border px-2 py-1 text-xs transition-colors {picked.has(cat.slug) ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}">
              <input type="checkbox" name="categories" value={cat.slug} on:change={() => toggle(cat.slug)} class="hidden" />
              {cat.name}
            </label>
          {/each}
        </div>
        <button class="btn-primary self-start text-sm">Create</button>
      </form>

      <!-- join, with agree-to-join -->
      <form method="POST" action="?/join" use:enhance class="panel flex flex-col gap-3 p-4">
        <p class="label">Join with a code</p>
        <input name="code" type="text" class="field font-mono uppercase" placeholder="ABC123" maxlength="12" />
        <input name="display_name" type="text" class="field" placeholder="Your name in the circle" maxlength="40" required />
        <label class="flex cursor-pointer items-start gap-2 text-xs text-muted">
          <input type="checkbox" name="agree" class="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]" />
          I agree to join and share my activity with this circle (rating stays private unless I turn it on).
        </label>
        <button class="btn self-start text-sm">Agree &amp; join</button>
      </form>
    </div>
  {/if}
</div>
