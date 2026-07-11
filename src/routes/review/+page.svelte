<script lang="ts">
  import { t } from '$lib/i18n/store';
  export let data;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtMs = (ms: number | null) => (ms == null ? '-' : (ms / 1000).toFixed(1) + 's');
</script>

<svelte:head><title>Review - Excogni</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <p class="label">Session history</p>
    <a href="/practice/run" class="btn">Practice again</a>
  </div>

  {#if data.sessions.length === 0}
    <div class="panel p-8 text-center">
      <p class="text-muted">No sessions yet. Your practice history will appear here.</p>
      <a href="/practice/run" class="btn-primary mt-4 inline-flex">{$t('w.startPracticing')}</a>
    </div>
  {:else}
    <div class="panel divide-y divide-edge">
      {#each data.sessions as s}
        <a href="/review/{s.id}" class="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3.5 transition-colors hover:bg-edge/30">
          <span class="font-mono text-sm text-body">{fmtDate(s.startedAt)}</span>
          <span class="text-sm text-muted"><span class="font-mono text-body">{s.attempts}</span> attempts</span>
          <span class="text-sm text-muted">
            <span class="font-mono {s.accuracy != null && s.accuracy >= 70 ? 'text-ok' : 'text-body'}">{s.accuracy ?? '-'}%</span> accuracy
          </span>
          <span class="text-sm text-muted"><span class="font-mono text-body">{fmtMs(s.avgMs)}</span> avg</span>
          <span class="text-sm text-muted">levels <span class="font-mono text-body">{s.minLevel}-{s.maxLevel}</span></span>
          <span class="ml-auto text-xs text-accent">open →</span>
        </a>
      {/each}
    </div>
  {/if}
</div>
