<script lang="ts">
  // Quiet ⓘ that reveals a short, plain explanation. Classy, not cluttered.
  // Clicking anywhere else (or Escape) dismisses it - tester feedback: an open tooltip
  // should never need hunting for the exact same ⓘ to close.
  export let text: string;
  let open = false;
  let root: HTMLElement;
  // Outside-click closes; clicks INSIDE (button or tooltip) are recognized by containment,
  // so no element needs its own click listener - which is what keeps this a11y-clean.
  function closeOnOutside(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function closeOnEscape(e: KeyboardEvent) { if (e.key === 'Escape') open = false; }
</script>

<svelte:window on:click={closeOnOutside} on:keydown={closeOnEscape} />

<span class="relative inline-flex items-center" bind:this={root}>
  <button
    type="button"
    class="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted/50 text-[9px] leading-none text-muted hover:border-accent hover:text-accent"
    on:click={() => (open = !open)}
    aria-label="What is this?"
  >i</button>
  {#if open}
    <span
      class="absolute left-0 top-5 z-20 w-56 max-w-[80vw] rounded border border-edge bg-surface p-3 text-xs font-normal normal-case leading-relaxed tracking-normal text-muted shadow-xl"
      role="tooltip"
    >{text}</span>
  {/if}
</span>
