<script lang="ts">
  export let data;
  const fmt = (iso: string) => new Date(iso).toLocaleString();
</script>

<svelte:head><title>Health - Excogni admin</title></svelte:head>

<div class="flex flex-col gap-8 py-6">
  <div class="flex items-baseline justify-between">
    <p class="label">Health</p>
    <a href="/admin" class="label text-muted hover:text-body">← Overview</a>
  </div>

  <!-- error pulse -->
  <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <div class="panel p-4">
      <p class="label">Errors (24h)</p>
      <p class="font-mono text-3xl {data.pulse.last24h > 0 ? 'text-bad' : 'text-ok'}">{data.pulse.last24h}</p>
    </div>
    <div class="panel p-4">
      <p class="label">Unseen</p>
      <p class="font-mono text-3xl {data.pulse.unseen > 0 ? 'text-accent' : 'text-muted'}">{data.pulse.unseen}</p>
    </div>
    <div class="panel p-4">
      <p class="label">Total logged</p>
      <p class="font-mono text-3xl text-muted">{data.pulse.total}</p>
    </div>
  </section>

  <!-- errors -->
  <section class="flex flex-col gap-3">
    <p class="label">Recent server errors</p>
    {#if data.errors.length === 0}
      <p class="panel p-5 text-sm text-ok">No errors logged. Clean so far.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.errors as e}
          <div class="px-4 py-3 text-sm">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-mono text-bad">{e.status ?? '-'} · {e.route ?? 'unknown route'}</span>
              <span class="text-xs text-muted">{fmt(e.occurredAt)}{e.userKind ? ` · ${e.userKind}` : ''}</span>
            </div>
            <p class="mt-1 break-words font-mono text-xs text-muted">{e.message}</p>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- feedback -->
  <section class="flex flex-col gap-3">
    <p class="label">User feedback</p>
    {#if data.feedback.length === 0}
      <p class="panel p-5 text-sm text-muted">No feedback yet.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.feedback as f}
          <div class="px-4 py-3 text-sm">
            <div class="flex items-baseline justify-between gap-3">
              <span class="font-mono {f.kind === 'inconsistency' ? 'text-bad' : 'text-accent'}">{f.kind ?? 'other'}{f.route ? ` · ${f.route}` : ''}</span>
              <span class="text-xs text-muted">{fmt(f.createdAt)}</span>
            </div>
            <p class="mt-1 break-words text-sm text-body">{f.message}</p>
            {#if f.snapshot}
              <details class="mt-2">
                <summary class="cursor-pointer text-xs text-muted hover:text-body">state snapshot</summary>
                <pre class="mt-1 overflow-x-auto rounded bg-ink p-2 text-[10px] text-muted">{JSON.stringify(f.snapshot, null, 2)}</pre>
              </details>
            {/if}
            {#if f.image}
              <details class="mt-2">
                <summary class="cursor-pointer text-xs text-muted hover:text-body">screen snapshot (best-effort)</summary>
                <img src={f.image} alt="reported screen" class="mt-1 max-w-full rounded border border-edge" />
              </details>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
