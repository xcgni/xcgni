<script lang="ts">
  export let data;

  function rel(iso: string): string {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return `${Math.floor(s)}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  const filters = [
    { key: 'active', lbl: 'active' },
    { key: 'resolved', lbl: 'resolved' },
    { key: 'ignored', lbl: 'ignored' },
    { key: 'all', lbl: 'all' }
  ];

  function href(params: { q?: string; filter?: string; sig?: string | null }): string {
    const p = new URLSearchParams();
    const q = params.q ?? data.q;
    const filter = params.filter ?? data.filter;
    if (q) p.set('q', q);
    if (filter !== 'active') p.set('filter', filter);
    if (params.sig) p.set('sig', params.sig);
    const s = p.toString();
    return '/admin/errors' + (s ? '?' + s : '');
  }
</script>

<svelte:head><title>Errors - Admin</title></svelte:head>

<div class="flex flex-col gap-5">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <h1 class="text-xl font-light">Errors</h1>
    <span class="font-mono text-[10px] text-muted">grouped by normalized message + top frame · numbers collapse to #</span>
  </div>

  <div class="flex flex-wrap items-center gap-3">
    <form method="GET" action="/admin/errors" class="flex items-center gap-2">
      {#if data.filter !== 'active'}<input type="hidden" name="filter" value={data.filter} />{/if}
      <input
        name="q"
        value={data.q}
        placeholder="search message or route"
        class="w-64 rounded border border-edge bg-ink px-3 py-1.5 font-mono text-xs"
      />
      <button class="btn text-xs" type="submit">Search</button>
      {#if data.q}<a href={href({ q: '', sig: null })} class="text-xs text-muted hover:text-body">clear</a>{/if}
    </form>
    <div class="flex items-center gap-1 text-xs">
      {#each filters as f (f.key)}
        <a
          href={href({ filter: f.key, sig: null })}
          class="rounded px-2 py-1 {data.filter === f.key ? 'bg-accent/15 text-accent' : 'text-muted hover:text-body'}">{f.lbl}</a>
      {/each}
    </div>
  </div>

  {#if data.groups.length === 0}
    <div class="panel p-5">
      <p class="text-sm text-muted">
        {data.q ? 'Nothing matches the search.' : 'No errors in this view. Quiet is good.'}
      </p>
    </div>
  {:else}
    <div class="panel divide-y divide-edge/60 p-0">
      {#each data.groups as g (g.signature)}
        <div class="flex flex-col gap-1.5 p-4 {data.sig === g.signature ? 'bg-accent/5' : ''}">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <a href={href({ sig: g.signature })} class="min-w-0 flex-1 font-mono text-sm text-body hover:text-accent">
              {g.message.length > 160 ? g.message.slice(0, 160) + '…' : g.message}
            </a>
            <span class="rounded bg-accent/15 px-2 py-0.5 font-mono text-xs text-accent" title="occurrences">×{g.count}</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
            {#if g.regressed}<span class="text-bad">REGRESSED</span>
            {:else if g.triage !== 'open'}<span>{g.triage}</span>{/if}
            {#if g.route}<span>{g.route}{g.routes > 1 ? ` +${g.routes - 1} more` : ''}</span>{/if}
            {#if g.status}<span>HTTP {g.status}</span>{/if}
            <span>last {rel(g.lastSeen)}</span>
            <span>first {rel(g.firstSeen)}</span>
            <span class="flex-1"></span>
            <form method="POST" action="?/setStatus" class="flex gap-2">
              <input type="hidden" name="signature" value={g.signature} />
              {#if g.triage === 'open' || g.regressed}
                <button name="status" value="resolved" class="hover:text-body">resolve</button>
                <button name="status" value="ignored" class="hover:text-body">ignore</button>
              {:else}
                <button name="status" value="open" class="hover:text-body">reopen</button>
              {/if}
            </form>
          </div>

          {#if data.sig === g.signature && data.occurrences}
            <div class="mt-2 flex flex-col gap-2 border-l-2 border-edge pl-3">
              {#each data.occurrences as o, i (o.occurredAt + i)}
                <div class="flex flex-col gap-1">
                  <div class="flex flex-wrap gap-3 font-mono text-[11px] text-muted">
                    <span class="text-body">{new Date(o.occurredAt).toLocaleString()}</span>
                    {#if o.route}<span>{o.route}</span>{/if}
                    {#if o.status}<span>HTTP {o.status}</span>{/if}
                    {#if o.userKind}<span>{o.userKind}</span>{/if}
                  </div>
                  {#if o.stack}
                    <details>
                      <summary class="cursor-pointer font-mono text-[11px] text-muted hover:text-body">stack</summary>
                      <pre class="mt-1 overflow-x-auto rounded bg-ink p-2 font-mono text-[11px] leading-relaxed text-muted">{o.stack}</pre>
                    </details>
                  {/if}
                </div>
              {/each}
              <a href={href({ sig: null })} class="font-mono text-[11px] text-muted hover:text-body">close ↑</a>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <p class="text-xs text-muted">
      Click a message to open its latest occurrences. Resolve marks a group handled - it comes
      back as REGRESSED if the error returns. Ignore hides expected noise. Events older than 30
      days are pruned by the daily housekeeping.
    </p>
  {/if}
</div>
