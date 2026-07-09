<script lang="ts">
  import { browser } from '$app/environment';
  // The pool ask, at the exact start of an anonymous run: anonymous practice is welcome for
  // trying things out, but it feeds nothing back - and the pool is the one resource the
  // product cannot build alone. Dismissible per visit (sessionStorage), never per account.
  let anonNoteDismissed = browser ? sessionStorage.getItem('excogni-anon-note') === '1' : true;
  function dismissAnonNote() { anonNoteDismissed = true; if (browser) sessionStorage.setItem('excogni-anon-note', '1'); }
  import { enhance } from '$app/forms';
  import ProgressWheel from '$lib/components/ProgressWheel.svelte';
  export let data;

  // local mirror of the enabled set so toggles feel instant; persists via enhance
  let enabled = new Set(data.categories.filter((c) => c.enabled).map((c) => c.slug));
  let savedFlash = false;
  let categoryForm: HTMLFormElement;

  function practiceHref(slug: string): string {
    if (slug === 'retention') return '/practice/retention';
    if (slug === 'reaction_time') return '/practice/reaction';
    return `/practice/run?category=${slug}`;
  }

  $: implementedSlugs = data.categories.filter((c) => c.implemented).map((c) => c.slug);
  $: enabledCount = data.categories.filter((c) => c.implemented && enabled.has(c.slug)).length;
  $: allOn = implementedSlugs.length > 0 && implementedSlugs.every((s) => enabled.has(s));

  // toggle-all: if everything's on, clear all; otherwise select all implemented categories.
  // Updating `enabled` flips the checkboxes reactively; then submit to persist (same path
  // as an individual toggle).
  function toggleAll() {
    if (allOn) {
      enabled = new Set();
    } else {
      enabled = new Set(implementedSlugs);
    }
    // let the checkbox state update, then submit the form to persist
    setTimeout(() => categoryForm?.requestSubmit(), 0);
  }
</script>

<svelte:head><title>Practice - Excogni</title></svelte:head>

<div class="flex flex-col gap-8">
  {#if !(data.user && !data.user.isAnonymous) && !anonNoteDismissed}
    <section class="panel flex flex-col gap-2 border-l-2 border-[rgb(var(--c-accent))] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-col gap-1">
        <p class="text-sm text-body">You're practicing anonymously - your results stay yours alone and never join the population pool.</p>
        <p class="text-xs text-muted">The pool is what makes percentiles real, and it's the one thing this project can't build alone. If Excogni is useful to you, the single biggest help: register (an email, nothing more - it exists to make fake data harder, never to identify you) and tick the research consent.{#if data.emailShield} And that email? We can't leak it - we don't have it. Only a one-way code ever reaches the database. <a href="/privacy#email" class="text-accent hover:underline">Learn how →</a>{/if}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <a href="/auth/login" class="btn-primary text-xs">Register &amp; join the pool</a>
        <button class="btn text-xs" on:click={dismissAnonNote} aria-label="Dismiss">Later</button>
      </div>
    </section>
  {/if}
  {#if data.readiness && data.readiness.overallPct < 100}
    <section class="panel flex items-center gap-5 p-4">
      <ProgressWheel readiness={data.readiness} size={96} showMessage={false} />
      <div class="flex flex-col gap-1">
        <p class="label">Your profile is filling in</p>
        <p class="text-sm text-muted">{data.readiness.message}</p>
        <a href="/stats" class="text-xs text-accent hover:underline">See your stats →</a>
      </div>
    </section>
  {/if}

  <section class="flex flex-col items-start gap-3">
    <p class="label">Practice</p>
    <a href="/practice/run" class="btn-primary text-base">Start mixed practice</a>
    <a href="/pulse" class="btn text-base" title="Ninety seconds, three items - the daily ritual">Daily pulse</a>
    <p class="text-sm text-muted">
      Mixed practice rotates through the {enabledCount} categor{enabledCount === 1 ? 'y' : 'ies'} you've ticked below.
      {#if savedFlash}<span class="text-ok">· saved</span>{/if}
    </p>
  </section>

  <section>
    <p class="label mb-1">Categories</p>
    <p class="mb-4 text-sm text-muted">Tick a category to include it in mixed practice, or train any one on its own.</p>

    <div class="mb-3 flex items-center justify-between">
      <button type="button" on:click={toggleAll} class="label text-accent hover:underline">
        {allOn ? 'Clear all' : 'Select all'}
      </button>
      <span class="label text-muted">{enabledCount} in mix</span>
    </div>

    <form
      bind:this={categoryForm}
      method="POST"
      action="?/saveCategories"
      use:enhance={() => {
        return async ({ update }) => {
          await update({ reset: false });
          savedFlash = true;
          setTimeout(() => (savedFlash = false), 1500);
        };
      }}
    >
      <div class="grid grid-cols-1 gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-3">
        {#each data.categories as cat}
          <div class="flex flex-col gap-2 bg-ink p-4">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm text-body">{cat.name}</p>
              {#if !cat.implemented}<span class="label whitespace-nowrap text-[10px]">Soon</span>{/if}
            </div>
            <p class="text-xs leading-snug text-muted">{cat.description}</p>

            {#if cat.implemented}
              <div class="mt-auto flex items-center justify-between gap-2 pt-1">
                <label class="flex cursor-pointer items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    name="category"
                    value={cat.slug}
                    checked={enabled.has(cat.slug)}
                    on:change={(e) => {
                      if (e.currentTarget.checked) enabled.add(cat.slug);
                      else enabled.delete(cat.slug);
                      enabled = enabled;
                      e.currentTarget.form?.requestSubmit();
                    }}
                    class="h-4 w-4 accent-[rgb(var(--c-accent))]"
                  />
                  In mix
                </label>
                <a href={practiceHref(cat.slug)} class="btn text-xs">Train</a>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </form>
  </section>
</div>
