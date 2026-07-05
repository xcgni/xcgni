<script lang="ts">
  import { page } from '$app/stores';
  $: status = $page.status;
  $: message = $page.error?.message ?? 'Something went wrong.';
  $: isNotFound = status === 404;
</script>

<svelte:head><title>{status} - Excogni</title></svelte:head>

<div class="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 py-16 text-center">
  <p class="font-mono text-6xl text-edge">{status}</p>
  <div class="flex flex-col gap-2">
    <p class="text-lg text-body">
      {#if isNotFound}
        That page isn't here.
      {:else}
        {message}
      {/if}
    </p>
    {#if !isNotFound}
      <p class="text-sm text-muted">The error has been logged. You can try again, or head back.</p>
    {/if}
  </div>
  <div class="flex gap-3">
    <a href="/stats" class="btn-primary">Dashboard</a>
    <a href="/" class="btn">Home</a>
  </div>
</div>
