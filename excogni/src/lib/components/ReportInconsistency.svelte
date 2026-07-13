<script lang="ts">
  // "Report inconsistency" - lets a tester flag that a challenge looks wrong, capturing a structured
  // STATE SNAPSHOT (the reliable, useful part) plus a BEST-EFFORT image (imperfect; may fail on some
  // browsers - we never block on it). Sends to the existing feedback API with kind 'inconsistency'.
  export let snapshot: Record<string, unknown> = {};

  let open = false;
  let note = '';
  let sending = false;
  let done = false;
  let error = '';

  async function captureImage(): Promise<string | null> {
    // Best-effort only. html2canvas re-renders the DOM to a canvas; it can't capture a true OS
    // screenshot and may mis-render SVG/canvas charts. We load it lazily from CDN and swallow any
    // failure - the snapshot is what matters, the image is a bonus.
    try {
      const mod = await import(/* @vite-ignore */ 'https://cdn.skypack.dev/html2canvas');
      const html2canvas = (mod.default ?? mod) as (el: HTMLElement, opts?: unknown) => Promise<HTMLCanvasElement>;
      const canvas = await html2canvas(document.body, { backgroundColor: '#0A0C10', scale: 0.5, logging: false });
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }

  async function submit() {
    sending = true;
    error = '';
    const fullSnapshot = {
      ...snapshot,
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
      at: new Date().toISOString()
    };
    const image = await captureImage();
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'inconsistency',
          message: note.trim() || 'Reported inconsistency (no note)',
          route: typeof location !== 'undefined' ? location.pathname : '',
          snapshot: fullSnapshot,
          image
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        error = d.error ?? 'Could not send.';
      } else {
        done = true;
        setTimeout(() => { open = false; done = false; note = ''; }, 1600);
      }
    } catch {
      error = 'Could not send.';
    } finally {
      sending = false;
    }
  }
</script>

<button
  type="button"
  class="text-xs text-muted underline-offset-2 hover:text-bad hover:underline"
  on:click={() => (open = true)}
>
  Report inconsistency
</button>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 sm:items-center" on:click|self={() => (open = false)} role="presentation">
    <div class="panel w-full max-w-md p-5">
      {#if done}
        <p class="text-sm text-ok">Thanks - sent with a snapshot of this screen. We'll take a look.</p>
      {:else}
        <p class="label mb-1">Report inconsistency</p>
        <p class="mb-3 text-xs text-muted">
          Something look wrong with this challenge - the prompt, the scoring, the answer? Tell us what
          you saw. We'll attach a snapshot of this screen automatically.
        </p>
        <textarea
          bind:value={note}
          rows="3"
          placeholder="What looked off? (optional, but helps)"
          class="field mb-3 text-sm"
        ></textarea>
        {#if error}<p class="mb-2 text-xs text-bad">{error}</p>{/if}
        <div class="flex justify-end gap-2">
          <button class="btn text-xs" on:click={() => (open = false)} disabled={sending}>Cancel</button>
          <button class="btn-primary text-xs" on:click={submit} disabled={sending}>
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
