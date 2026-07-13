<script lang="ts">
  import { t } from '$lib/i18n/store';
  export let data;
</script>

<svelte:head>
  <title>Daily pulse - Excogni</title>
  <meta name="description" content="Ninety seconds. Three items. A stream, not a snapshot." />
</svelte:head>

<div class="mx-auto flex max-w-md flex-col items-center gap-8 px-4 py-14 text-center">
  <div>
    <p class="label mb-2">{$t('pulse.title')}</p>
    <h1 class="text-2xl font-light">{$t('pulse.subtitle')}</h1>
  </div>

  <div class="panel flex w-full flex-col items-center gap-2 p-8">
    <p class="font-mono text-6xl">{data.daysPracticed}</p>
    <p class="label">{$t('pulse.daysPracticed')}</p>
    <p class="mt-2 max-w-xs text-xs text-muted">
{$t('pulse.countNote')}
    </p>
  </div>

  {#if data.weather}
    <p class="max-w-sm text-sm text-muted" title={data.weather.detail}>{data.weather.line}</p>
  {/if}

  {#if data.todayDone}
    <p class="text-sm text-muted">{$t('pulse.todayDone')}</p>
    <div class="flex flex-wrap justify-center gap-3">
      <a class="btn-primary" href="/stats">{$t('pulse.seeStream')}</a>
      <a class="btn" href="/practice/run">{$t('pulse.fullSession')}</a>
    </div>
  {:else}
    <a class="btn-primary px-8 py-3 text-lg" href="/practice/run?pulse=1&skipintro=1">{$t('pulse.start')}</a>
    <p class="text-xs text-muted">{$t('pulse.startNote')}</p>
  {/if}
</div>
