<script lang="ts">
  export let data;
  export let form;

  function isSim(key: string) { return key === 'simulatedUsers' || key === 'statsPreview'; }
</script>

<svelte:head><title>Toggles - Admin</title></svelte:head>

<div class="flex flex-col gap-8">
  <div>
    <p class="label text-accent">Toggles</p>
    <h1 class="text-xl font-light">Experimental features &amp; mock data.</h1>
    <p class="mt-1 text-xs text-muted">Changes take effect within a few seconds, no redeploy. Each flag falls back to its deploy-time default unless overridden here.</p>
  </div>

  {#if form?.error}<p class="text-sm text-bad">{form.error}</p>{/if}
  {#if form?.saved}<p class="text-sm text-ok">Updated.</p>{/if}
  {#if form?.reset}<p class="text-sm text-ok">Reset to default.</p>{/if}

  <!-- mock data context banner -->
  <div class="panel flex flex-col gap-2 border-l-2 border-l-accent p-4">
    <p class="label">Mock data status</p>
    <p class="text-sm text-body">
      {data.simCount.toLocaleString()} simulated users currently in the database.
    </p>
    <p class="text-xs leading-relaxed text-muted">
      While the <span class="font-mono">simulated reference population</span> flag is ON, these populate the
      blue population points, distributions, and percentiles - so the experience looks alive before real
      data exists. Real users' own scores are never affected; only what they're compared against. Flip it
      OFF once you have enough real users and every statistic recomputes against real humans only. The
      simulated rows stay quarantined (tagged is_simulated) and can be deleted wholesale at any time.
    </p>
  </div>

  <!-- the flags -->
  <div class="flex flex-col gap-3">
    {#each data.flags as fl}
      <div class="panel flex flex-col gap-3 p-4 {isSim(fl.key) ? 'border-l-2 border-l-edge' : ''}">
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <span class="text-body">{fl.label}</span>
              <span class="font-mono text-[10px] {fl.on ? 'text-ok' : 'text-muted'}">{fl.on ? '● ON' : '○ OFF'}</span>
              {#if fl.source === 'override'}<span class="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">overridden</span>{/if}
            </div>
            <p class="max-w-xl text-xs leading-relaxed text-muted">{fl.description}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            <form method="POST" action="?/set">
              <input type="hidden" name="key" value={fl.key} />
              <input type="hidden" name="value" value={(!fl.on).toString()} />
              <button class="btn text-xs {fl.on ? 'text-muted hover:text-bad' : 'text-ok'}">{fl.on ? 'Turn off' : 'Turn on'}</button>
            </form>
            {#if fl.source === 'override'}
              <form method="POST" action="?/reset">
                <input type="hidden" name="key" value={fl.key} />
                <button class="text-[10px] text-muted hover:text-body">reset to default</button>
              </form>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <p class="text-xs text-muted">
    To generate or refresh the simulated population, run <span class="font-mono">node scripts/gen-mock-data.mjs</span>
    on the server. To remove it entirely: <span class="font-mono">DELETE FROM users WHERE is_simulated = true;</span>
  </p>
</div>
