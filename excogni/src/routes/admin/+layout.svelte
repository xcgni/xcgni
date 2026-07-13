<script lang="ts">
  export let data;
</script>

<svelte:head><title>Excogni · Admin</title></svelte:head>

<div class="min-h-dvh bg-ink text-body">
  <header class="border-b border-edge">
    <div class="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <span class="font-mono text-sm tracking-widest text-accent">EXCOGNI · ADMIN</span>
        <span class="label">research instrument · read-only · aggregates only</span>
      </div>
      <!-- wraps into tidy rows at any width; a hidden horizontal scroll on desktop is worse than a second row -->
      <nav class="flex flex-wrap gap-x-4 gap-y-1.5 text-sm lg:justify-end">
        <a href="/admin" class="whitespace-nowrap text-muted hover:text-body">Overview</a>
        <a href="/admin/challenges" class="whitespace-nowrap text-muted hover:text-body">Challenges</a>
        <a href="/admin/toggles" class="whitespace-nowrap text-muted hover:text-body">Toggles</a>
        <a href="/admin/explore" class="whitespace-nowrap text-muted hover:text-body">Explore</a>
        <a href="/admin/temporal" class="whitespace-nowrap text-muted hover:text-body">Temporal</a>
        <a href="/methodology" class="whitespace-nowrap text-muted hover:text-body">Methodology</a>
        <a href="/admin/health" class="whitespace-nowrap text-muted hover:text-body">Health</a>
        <a href="/admin/errors" class="whitespace-nowrap text-muted hover:text-body">Errors</a>
        <a href="/admin/export" class="whitespace-nowrap text-muted hover:text-body">Export</a>
        {#if !data.isLogin}
          <form method="POST" action="/admin/logout" class="inline">
            <button type="submit" class="whitespace-nowrap text-muted hover:text-body">Log out</button>
          </form>
        {/if}
      </nav>
    </div>
  </header>
  <main class="mx-auto max-w-6xl px-4 py-8">
    <slot />
  </main>
  <footer class="mx-auto max-w-6xl px-4 py-6 text-xs text-muted">
    No group below {data.minCell} is ever displayed. Attribute slices use consented data only.
    Numbers carry n and uncertainty; comparisons carry effect size. This tool observes - it cannot identify individuals.
  </footer>
</div>
