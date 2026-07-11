<script lang="ts">
  import { t, locale } from '$lib/i18n/store';
  export let data;
  import { COUNTRIES, LANGUAGES, AGE_BANDS, EDUCATION, HANDEDNESS } from '$lib/demographics';
  import { onMount } from 'svelte';

  // First-run experience. A brief instrument "power-on", then short, honest, skippable intro
  // steps, then an optional about-you form. The copy is deliberately plain and truthful; the
  // motion exists to make the first 30 seconds feel crafted, not to oversell.

  // -1 = boot sequence playing; 0..3 = intro steps; 4 = about-you form.
  let step = -1;

  $: steps = ([1, 2, 3, 4] as const).map((i) => ({
    label: $t(('w.s' + i + 'l') as never),
    title: $t(('w.s' + i + 't') as never),
    body: $t(('w.s' + i + 'b') as never)
  }));

  $: current = step >= 0 && step < steps.length ? steps[step] : null;
  $: isIntro = step >= 0 && step < steps.length;

  $: bootLines = [$t('w.boot1'), $t('w.boot2'), $t('w.boot3'), $t('w.boot4')];
  let bootShown = 0;

  onMount(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tick = reduce ? 90 : 520;
    const id = setInterval(() => {
      bootShown += 1;
      if (bootShown >= bootLines.length) {
        clearInterval(id);
        setTimeout(() => { step = 0; }, reduce ? 100 : 650);
      }
    }, tick);
    return () => clearInterval(id);
  });

  function skipBoot() { step = 0; }
</script>

<svelte:head><title>Welcome - Excogni</title></svelte:head>

{#if step === -1}
  <button
    type="button"
    on:click={skipBoot}
    class="mx-auto flex min-h-[70vh] w-full max-w-lg cursor-pointer flex-col justify-center gap-6 text-left"
    aria-label="Skip intro animation"
  >
    <div class="flex items-center gap-3">
      <span class="relative flex h-2.5 w-2.5">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60"></span>
        <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent"></span>
      </span>
      <span class="label text-accent">Excogni</span>
    </div>
    <div class="flex flex-col gap-2 font-mono text-sm">
      {#each bootLines as line, i}
        {#if i < bootShown}
          <div class="flex items-center gap-2 text-muted" style="animation: fadeup .4s ease both">
            <span class="text-ok">+</span><span>{line}</span>
          </div>
        {/if}
      {/each}
    </div>
    <p class="font-mono text-xs text-muted/50">tap to skip</p>
  </button>
{:else}
  <div class="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-8">
    <div class="flex items-center gap-2">
      {#each Array(steps.length + 1) as _, i}
        <div class="h-0.5 flex-1 transition-colors duration-500 {i <= step ? 'bg-accent' : 'bg-edge'}"></div>
      {/each}
    </div>

    <form method="POST" action="?/begin" class="flex flex-col gap-8">
      {#if isIntro && current}
        {#key step}
          <div class="flex flex-col gap-4" style="animation: fadeup .45s ease both">
            <p class="label text-accent">{current.label}</p>
            <h1 class="text-2xl font-light leading-snug sm:text-3xl">{current.title}</h1>
  {#if $locale !== 'en'}<p class="mt-2 text-xs text-muted">{$t('page.enOnly')}</p>{/if}
            <p class="leading-relaxed text-muted">{current.body}</p>
          </div>
        {/key}
      {:else}
        <div class="flex flex-col gap-5" style="animation: fadeup .45s ease both">
          <div class="flex flex-col gap-2">
            <p class="label text-accent">{$t('wd.aboutYou')}</p>
            <h1 class="text-2xl font-light leading-snug sm:text-3xl">A few optional details.</h1>
            <p class="text-sm leading-relaxed text-muted">
              All optional, all editable later in Settings. They let us study how cognition
              varies across people - and you can skip every one. Nothing here affects your score.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">Age</span>
              <select name="age_band" class="field">
                <option value="">{$t('wd.prefNot')}</option>
                {#each AGE_BANDS as b}<option value={b}>{b}</option>{/each}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">Country</span>
              <select name="country" class="field">
                <option value="">{$t('wd.prefNot')}</option>
                {#each COUNTRIES as c}<option value={c}>{c}</option>{/each}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">City <span class="text-muted/60">(optional)</span></span>
              <input name="city" type="text" class="field" placeholder="e.g. Zagreb" autocomplete="off" />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">{$t('wd.native')}</span>
              <select name="native_language" class="field">
                <option value="">{$t('wd.prefNot')}</option>
                {#each LANGUAGES as l}<option value={l}>{l}</option>{/each}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted">{$t('wd.education')}</span>
              <select name="education" class="field">
                <option value="">{$t('wd.prefNot')}</option>
                {#each EDUCATION as e}<option value={e.value}>{e.label}</option>{/each}
              </select>
            </label>
            <label class="flex flex-col gap-1 text-sm sm:col-span-2">
              <span class="text-muted">{$t('wd.handed')}</span>
              <select name="handedness" class="field">
                <option value="">{$t('wd.prefNot')}</option>
                {#each HANDEDNESS as h}<option value={h.value}>{h.label}</option>{/each}
              </select>
            </label>
          </div>

          <!-- Preferred retention decks: what would you like to memorize? Empty = all decks. -->
          <div class="flex flex-col gap-2 border-t border-edge pt-4">
            <p class="text-sm text-body">What would you like to memorize? <span class="text-muted">(retention decks; pick any, or none for all)</span></p>
            <div class="flex flex-wrap gap-1.5">
              {#each data.decks ?? [] as d}
                <label class="cursor-pointer">
                  <input type="checkbox" name="preferred_decks" value={d.slug} checked={data.preferredDecks?.includes(d.slug)} class="peer sr-only" />
                  <span class="inline-block rounded border border-edge px-2.5 py-1 text-xs text-muted peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent">{d.label}</span>
                </label>
              {/each}
            </div>
          </div>

          <div class="flex flex-col gap-2 border-t border-edge pt-4">
            <label class="flex cursor-pointer items-start gap-2 text-sm">
              <input name="consented_research" type="checkbox" class="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]" />
              <span class="text-muted">{$t('wd.share')} <span class="text-body">anonymised results</span> for research. De-identified, never tied to me, and I can turn it off anytime.
                <span class="block pt-1 text-xs">Contribution counts only once you register: the email exists to make fake and duplicate data harder, never to identify you - aggregates carry no identity.</span></span>
            </label>
            <details class="ml-6 text-xs text-muted">
              <summary class="cursor-pointer hover:text-body">{$t('wd.cover')}<!-- --></summary>
              <p class="mt-2 leading-relaxed">
                Your anonymised results feed the public population statistics and may be kept for long-term
                research. Neither is linked to your identity. It's optional - leave it unticked and everything
                still works.
              </p>
            </details>
          </div>
        </div>
      {/if}

      <div class="flex items-center justify-between">
        <div>
          {#if step > 0}
            <button type="button" class="text-sm text-muted hover:text-body" on:click={() => (step -= 1)}>Back</button>
          {/if}
        </div>
        <div class="flex items-center gap-4">
          {#if isIntro}
            <button type="submit" class="absolute right-4 top-4 text-sm text-muted hover:text-body">{$t('w.skip')}</button>
            <button type="button" class="btn-primary" on:click={() => (step += 1)}>
              {step === steps.length - 1 ? 'Almost there' : 'Next'}
            </button>
          {:else}
            <button type="submit" class="btn-primary">{$t('w.startPracticing')}</button>
          {/if}
        </div>
      </div>
    </form>
  </div>
{/if}

<style>
  @keyframes fadeup {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
