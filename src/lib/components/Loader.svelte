<script lang="ts">
  // The radar sweep: Excogni's mark, working. Used for every loading moment so waiting itself
  // carries the identity (a scanning instrument), instead of a generic spinner. Pure CSS
  // (.loader in app.css), theme-aware via the scheme's accent, reduced-motion safe.
  export let size: 'sm' | 'md' = 'md';
  export let label = '';
</script>

<div class="flex flex-col items-center gap-3" role="status" aria-live="polite">
  <div class="loader {size === 'sm' ? 'loader-sm' : ''}" aria-hidden="true"></div>
  {#if label}<p class="text-xs text-muted">{label}</p>{/if}
  <span class="sr-only">Loading</span>
</div>
