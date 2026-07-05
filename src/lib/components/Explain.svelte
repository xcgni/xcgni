<script lang="ts">
  // Quiet ⓘ that reveals a short, plain explanation. Classy, not cluttered.
  // Clicking anywhere else (or Escape) dismisses it - tester feedback: an open tooltip
  // should never need hunting for the exact same ⓘ to close.
  export let text: string;
  let open = false;
  function closeOnOutside() { if (open) open = false; }
  function closeOnEscape(e: KeyboardEvent) { if (e.key === 'Escape') open = false; }
</script>

<svelte:window on:click={closeOnOutside} on:keydown={closeOnEscape} />

<span class="relative inline-flex items-center">
  <button
    type="button"
    class="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted/50 text-[9px] leading-none text-muted hover:border-accent hover:text-accent"
    on:click|stopPropagation={() => (open = !open)}
    aria-label="What is this?"
  >i</button>
  {#if open}
    <span
      class="absolute left-0 top-5 z-20 w-56 max-w-[80vw] rounded border border-edge bg-surface p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-muted shadow-xl"
      on:click|stopPropagation
      role="tooltip"
    >{text}</span>
  {/if}
</span>
