<script lang="ts">
  export let data;
</script>

<svelte:head>
  <title>Findings from the pool - Excogni</title>
  <meta name="description" content="Population-level patterns from the consented commons: each with n, effect size, and honest confounds. Withheld groups shown as withheld." />
</svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
  <div>
    <p class="label mb-1"><a href="/statistics" class="hover:text-body">Statistics</a> · Findings</p>
    <h1 class="text-2xl font-light">Findings from the pool</h1>
    <p class="mt-2 text-sm text-muted">
      What the commons has learned about itself. Computed from consented users only, each
      finding gated by the anonymity floor per compared group and an effect bar. Null results
      are published; withheld groups are shown as withheld, never silently omitted. Anchored
      to pool size, not dates.
    </p>
    {#if data.preview}
      <p class="mt-2 rounded border border-accent/40 bg-accent/10 p-2 text-xs text-accent">
        Preview - includes simulated data while the real pool grows. This label disappears
        when the flag is turned off.
      </p>
    {/if}
  </div>

  <p class="font-mono text-xs text-muted">consented pool: {data.poolUsers} users</p>

  <div class="flex flex-col gap-3">
    {#each data.findings as f (f.id)}
      <section class="panel flex flex-col gap-1 p-5 {f.status === 'withheld' ? 'opacity-70' : ''}">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="label">{f.title}</h2>
          <span class="font-mono text-[10px] {f.status === 'published' ? 'text-accent' : 'text-muted'}">
            {f.status}{#if f.nUsers} · n={f.nUsers}{/if}
          </span>
        </div>
        <p class="text-sm {f.status === 'withheld' ? 'text-muted' : 'text-body'}">{f.sentence}</p>
        <p class="text-xs text-muted">{f.detail}</p>
      </section>
    {/each}
  </div>

  <p class="text-xs text-muted">
    Everything the pool produces is free for everyone, including those who never register.
    Registering and ticking research consent is what makes your results count toward it.
    Method and confounds: <a href="/methodology" class="underline hover:text-body">methodology</a>.
  </p>
</div>
