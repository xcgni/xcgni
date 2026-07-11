<script lang="ts" context="module">
  import { keyboardOpen } from '$lib/stores/keyboard';
  import { page } from '$app/stores';
  import { writable } from 'svelte/store';
  export const feedbackOpen = writable(false);
</script>

<script lang="ts">
  import { page } from '$app/stores';

  let open = false;
  feedbackOpen.subscribe((v) => { if (v) { open = true; feedbackOpen.set(false); } });
  let kind: 'bug' | 'confusing' | 'idea' | 'other' = 'confusing';
  let message = '';
  let sending = false;
  let sent = false;
  let error = '';

  async function send() {
    if (!message.trim()) return;
    sending = true;
    error = '';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, message, route: $page.url.pathname })
      });
      if (!res.ok) throw new Error('Could not send');
      sent = true;
      message = '';
      setTimeout(() => { open = false; sent = false; }, 1600);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not send';
    } finally {
      sending = false;
    }
  }
</script>

{#if open}
  <div class="fixed bottom-16 right-4 z-50 w-72 max-sm:inset-x-3 max-sm:bottom-20 max-sm:w-auto rounded border border-edge bg-surface p-4 shadow-lg">
    {#if sent}
      <p class="py-4 text-center text-sm text-ok">Thanks - noted.</p>
    {:else}
      <p class="label mb-2">Something feel off?</p>
      <div class="mb-2 flex flex-wrap gap-1">
        {#each [['confusing', 'Confusing'], ['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Other']] as [k, lbl]}
          <button
            class="rounded border px-2 py-0.5 text-xs {kind === k ? 'border-accent text-accent' : 'border-edge text-muted'}"
            on:click={() => (kind = k)}
          >{lbl}</button>
        {/each}
      </div>
      <textarea
        bind:value={message}
        rows="3"
        placeholder="What happened, or what would help?"
        class="field w-full text-sm"
      ></textarea>
      {#if error}<p class="mt-1 text-xs text-bad">{error}</p>{/if}
      <div class="mt-2 flex justify-between">
        <button class="text-xs text-muted hover:text-body" on:click={() => (open = false)}>Cancel</button>
        <button class="btn text-xs" disabled={sending || !message.trim()} on:click={send}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <a href="/contribute" class="mt-2 block border-t border-edge pt-2 text-xs text-accent hover:underline">Contribute methodologically →</a>
    {/if}
  </div>
{/if}

<button
  class="fixed bottom-4 right-4 z-50 rounded-full max-sm:bottom-[4.5rem] {($keyboardOpen || /^\/practice\/(run|retention|reaction)/.test($page.url.pathname)) ? 'max-sm:hidden' : ''} border border-edge bg-surface px-3 py-2 text-xs text-muted shadow hover:text-body"
  on:click={() => (open = !open)}
  aria-label="Send feedback"
>
  {open ? 'close' : 'feedback'}
</button>
