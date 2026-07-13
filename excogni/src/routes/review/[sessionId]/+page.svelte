<script lang="ts">
  export let data;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtMs = (ms: number | null) => (ms == null ? '-' : (ms / 1000).toFixed(1) + 's');

  $: mistakes = data.attempts.filter((a) => a.correct === false);
</script>

<svelte:head><title>Session review - Excogni</title></svelte:head>

<div class="flex flex-col gap-6">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <a href="/review" class="text-sm text-muted hover:text-body">← All sessions</a>
    <a href="/practice/run" class="btn">Practice again</a>
  </div>

  <div>
    <p class="label mb-1">Session</p>
    <p class="font-mono text-sm text-muted">{fmtDate(data.summary.startedAt)}</p>
  </div>

  <div class="panel grid grid-cols-2 gap-px bg-edge p-0 sm:grid-cols-4">
    <div class="bg-surface p-4 text-center">
      <p class="label mb-1">Attempts</p>
      <p class="font-mono text-xl">{data.summary.attempts}</p>
    </div>
    <div class="bg-surface p-4 text-center">
      <p class="label mb-1">Accuracy</p>
      <p class="font-mono text-xl {data.summary.accuracy != null && data.summary.accuracy >= 70 ? 'text-ok' : ''}">{data.summary.accuracy ?? '-'}%</p>
    </div>
    <div class="bg-surface p-4 text-center">
      <p class="label mb-1">Avg time</p>
      <p class="font-mono text-xl">{fmtMs(data.summary.avgMs)}</p>
    </div>
    <div class="bg-surface p-4 text-center">
      <p class="label mb-1">Levels</p>
      <p class="font-mono text-xl">{data.summary.minLevel}-{data.summary.maxLevel}</p>
    </div>
  </div>

  {#if mistakes.length > 0}
    <div>
      <p class="label mb-3">Mistakes ({mistakes.length})</p>
      <div class="panel divide-y divide-edge">
        {#each mistakes as a}
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
            <span class="font-mono text-body">{a.prompt}</span>
            <span class="flex flex-wrap items-baseline gap-x-4 text-sm">
              <span class="text-muted">{a.categoryName} L{a.level}</span>
              <span class="font-mono text-bad">{a.yourAnswer ?? '-'}</span>
              <span class="text-muted">→</span>
              <span class="font-mono text-ok">{a.correctAnswer ?? "-"}</span>
              <span class="font-mono text-muted">{fmtMs(a.effectiveMs)}</span>
            </span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <p class="panel p-4 text-center text-sm text-ok">No mistakes this session. Clean run.</p>
  {/if}

  <details class="panel group">
    <summary class="flex cursor-pointer list-none items-center justify-between p-4 hover:bg-edge/30">
      <span class="label">All attempts ({data.attempts.length})</span>
      <span class="text-xs text-muted group-open:hidden">show</span>
      <span class="hidden text-xs text-muted group-open:inline">hide</span>
    </summary>
    <div class="overflow-x-auto border-t border-edge">
      <table class="w-full min-w-[640px] text-sm">
        <thead>
          <tr class="text-left">
            <th class="label p-3 font-normal">Challenge</th>
            <th class="label p-3 font-normal">Cat / Lv</th>
            <th class="label p-3 font-normal">You</th>
            <th class="label p-3 font-normal">Answer</th>
            <th class="label p-3 font-normal">Time</th>
          </tr>
        </thead>
        <tbody>
          {#each data.attempts as a}
            <tr class="border-t border-edge/60">
              <td class="p-3 font-mono">{a.prompt}</td>
              <td class="p-3 text-muted">{a.categoryName} L{a.level}</td>
              <td class="p-3 font-mono {a.correct ? 'text-ok' : 'text-bad'}">
                {#if a.fluencyWords && a.fluencyWords.length > 0}
                  <span class="flex flex-wrap gap-1">
                    {#each a.fluencyWords as fw}
                      <span class="rounded px-1.5 py-0.5 text-xs {fw.ok ? 'bg-ok/15 text-ok' : 'text-muted line-through opacity-60'}">{fw.word}</span>
                    {/each}
                  </span>
                {:else}
                  {a.yourAnswer ?? '-'}
                {/if}
              </td>
              <td class="p-3 font-mono text-muted">{a.correctAnswer ?? "-"}</td>
              <td class="p-3 font-mono text-muted">{fmtMs(a.effectiveMs)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
</div>
