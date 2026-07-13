<script lang="ts">
  // A lightweight, dismissible cookie notice - NOT a consent wall. Excogni sets only first-party,
  // strictly-necessary cookies (session/auth) plus a UI-variant preference and a first-visit flag.
  // There is no analytics, advertising, or third-party tracking, so under GDPR/ePrivacy an
  // informational notice is appropriate rather than a blocking consent gate. The site stays fully
  // usable while this is shown; dismissing it just records that it's been seen.
  import { onMount } from 'svelte';

  let show = false;
  const KEY = 'excogni_cookie_notice';

  function hasFlag(): boolean {
    if (typeof document === 'undefined') return true;
    return document.cookie.split('; ').some((c) => c.startsWith(KEY + '='));
  }

  function dismiss() {
    // 1-year first-party cookie; not httpOnly because it's set/read client-side only and carries no
    // sensitive data - just "this notice has been acknowledged".
    document.cookie = `${KEY}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    show = false;
  }

  onMount(() => {
    show = !hasFlag();
  });
</script>

{#if show}
  <div
    class="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-surface/95 px-4 py-3 backdrop-blur sm:px-6"
    role="region"
    aria-label="Cookie notice"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs leading-relaxed text-muted">
        Excogni uses only essential first-party cookies - to keep you signed in and remember your
        preferences. No analytics, no advertising, no third-party tracking. More in
        <a href="/about" class="text-accent hover:underline">about</a>.
      </p>
      <button
        type="button"
        class="shrink-0 rounded border border-edge px-4 py-1.5 text-xs text-body transition-colors hover:border-accent hover:text-accent"
        on:click={dismiss}
      >
        Got it
      </button>
    </div>
  </div>
{/if}
