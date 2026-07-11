<script lang="ts">
  import { t } from '$lib/i18n/store';
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
            <p class="leading-relaxed text-muted measure prose-quiet mx-auto">{current.body}</p>
          </div>
        {/key}
      {:else}
        <div class="flex flex-col gap-5" style="animation: fadeup .45s ease both">
          <div class="flex flex-col gap-2">
            <p class="label text-accent">{$t('nav.anonymous')}</p>
            <h1 class="text-2xl font-light leading-snug sm:text-3xl">{$t('w.finalTitle')}</h1>
            <p class="text-sm text-muted"><span class="measure prose-quiet inline-block">{$t('w.equalAnon')}</span></p>
            <a href="/privacy" class="text-sm text-accent underline-offset-2 hover:underline">{$t('w.howWeProtect')}</a>
          </div>
        </div>
      {/if}
        <div class="flex items-center gap-4">
          {#if isIntro}
            <button type="submit" class="absolute right-4 top-4 text-sm text-muted hover:text-body">{$t('w.skip')}</button>
            <button type="button" class="btn-primary" on:click={() => (step += 1)}>
              {step === steps.length - 1 ? $t('w.almost') : $t('w.next')}
            </button>
          {:else}
            <button type="submit" class="btn-primary">{$t('w.startAnon')}</button>
            <a href="/auth/login" class="btn">{$t('w.register')}</a>
          {/if}
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
