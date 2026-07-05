<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { TAG_GROUPS } from '$lib/tags';
  export let askDaily = false;
  export let askNap = false;

  const dispatch = createEventDispatcher();

  // local state
  let sleepHours: number | null = null;
  let napped: boolean | null = null;
  let rested: string | null = null;
  let hoursAwake: number | null = null;
  let caffeine: string | null = null;
  let otherStimulant: boolean | null = null;
  let alertness: string | null = null;
  let mood: string | null = null;
  let selectedTags = new Set<string>();
  let note = '';
  let openGroup: string | null = null;
  let saving = false;
  let moreTags = false;

  // Quick tags: the user's own recently-used tags first (private, localStorage), falling back to
  // sensible defaults. One tap for the common case; the full taxonomy stays under "more".
  const TAG_LABEL = new Map(TAG_GROUPS.flatMap((g) => g.tags.map((t) => [t.slug, t.label] as [string, string])));
  const QUICK_DEFAULTS = ['coffee', 'poor-sleep', 'good-sleep', 'exercise', 'stressed', 'tired', 'deep-work', 'sick'];
  let quickTags: string[] = QUICK_DEFAULTS;
  try {
    const recent = JSON.parse(localStorage.getItem('excogni.recentTags') ?? '[]');
    if (Array.isArray(recent) && recent.length > 0) {
      quickTags = [...new Set([...recent, ...QUICK_DEFAULTS])].filter((t) => TAG_LABEL.has(t)).slice(0, 8);
    }
  } catch { /* no storage - defaults are fine */ }

  function rememberTags() {
    try {
      const prev = JSON.parse(localStorage.getItem('excogni.recentTags') ?? '[]');
      const next = [...new Set([...selectedTags, ...(Array.isArray(prev) ? prev : [])])].slice(0, 8);
      localStorage.setItem('excogni.recentTags', JSON.stringify(next));
    } catch { /* best effort */ }
  }

  function toggleTag(slug: string) {
    if (selectedTags.has(slug)) selectedTags.delete(slug);
    else selectedTags.add(slug);
    selectedTags = selectedTags; // trigger reactivity
  }

  function deviceKind(): string {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function localDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function submit() {
    if (saving) return;
    saving = true;
    try {
      await fetch('/api/session-context', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          localDate: localDate(),
          sleepHours, napped, rested, hoursAwake, caffeine, otherStimulant, alertness, mood,
          tags: [...selectedTags],
          note: note.trim() || null,
          deviceKind: deviceKind()
        })
      });
    } catch {
      // best-effort - never block practice on the questionnaire
    } finally {
      rememberTags();
      dispatch('done');
    }
  }

  // a small reusable option group renders below via markup
  const restedOpts = [['poor', 'Poorly'], ['ok', 'OK'], ['good', 'Well']];
  const awakeOpts = [['1', 'Just woke'], ['3', 'A few hours'], ['8', 'Most of the day'], ['14', 'A long day']];
  const caffeineOpts = [['none', 'None'], ['some', 'Some'], ['lots', 'Lots']];
  const alertOpts = [['tired', 'Tired'], ['ok', 'OK'], ['wired', 'Wired']];
  const moodOpts = [['low', 'Low'], ['neutral', 'Neutral'], ['good', 'Good']];
</script>

<div class="mx-auto flex max-w-md flex-col gap-6 py-8">
  <div class="flex flex-col gap-1">
    <p class="label text-accent">Before you start</p>
    <p class="text-xs text-muted">Why we ask: your answers power your own insights - comparing your
      days with and without each factor. Private to you, never shared, and everything is optional.</p>
    <p class="text-sm leading-relaxed text-muted">
      A few optional questions. They help us understand how state affects performance -
      and, in time, tell you when you personally function best. Skip any or all; it never
      affects your score.
    </p>
  </div>

  {#if askDaily}
    <div class="flex flex-col gap-2">
      <p class="text-sm text-body">Hours slept last night</p>
      <div class="flex items-center gap-3">
        <input
          type="range" min="0" max="12" step="0.5"
          value={sleepHours ?? 7}
          on:input={(e) => (sleepHours = parseFloat(e.currentTarget.value))}
          class="flex-1 {sleepHours == null ? 'opacity-40 grayscale' : 'accent-[rgb(var(--c-accent))]'}"
        />
        <span class="w-16 font-mono text-sm {sleepHours == null ? 'text-muted' : 'text-accent'}">{sleepHours == null ? 'not set' : sleepHours + 'h'}</span>
      </div>
      {#if sleepHours == null}
        <p class="text-xs text-muted">Drag to answer, or leave unset to skip.</p>
      {/if}
    </div>

    <div class="flex flex-col gap-2">
      <p class="text-sm text-body">How rested do you feel?</p>
      <div class="flex gap-2">
        {#each restedOpts as [val, lbl]}
          <button class="flex-1 rounded border px-3 py-1.5 text-sm transition-colors {rested === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
            on:click={() => (rested = rested === val ? null : val)}>{lbl}</button>
        {/each}
      </div>
      <p class="text-xs text-muted">How you feel can matter more than the hours.</p>
    </div>

    <div class="flex flex-col gap-2">
      <p class="text-sm text-body">How long have you been awake?</p>
      <div class="flex gap-2">
        {#each awakeOpts as [val, lbl]}
          <button class="flex-1 rounded border px-2 py-1.5 text-xs transition-colors {String(hoursAwake) === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
            on:click={() => (hoursAwake = String(hoursAwake) === val ? null : parseInt(val))}>{lbl}</button>
        {/each}
      </div>
    </div>
  {:else if askNap}
    <label class="flex cursor-pointer items-center gap-2 text-sm text-body">
      <input type="checkbox" bind:checked={napped} class="h-4 w-4 accent-[rgb(var(--c-accent))]" />
      Had a nap or extra rest since last session?
    </label>
  {/if}

  <div class="flex flex-col gap-2">
    <p class="text-sm text-body">Caffeine today</p>
    <div class="flex gap-2">
      {#each caffeineOpts as [val, lbl]}
        <button class="flex-1 rounded border px-3 py-1.5 text-sm transition-colors {caffeine === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
          on:click={() => (caffeine = caffeine === val ? null : val)}>{lbl}</button>
      {/each}
    </div>
    <label class="flex cursor-pointer items-center gap-2 text-xs text-muted">
      <input type="checkbox" bind:checked={otherStimulant} class="h-3.5 w-3.5 accent-[rgb(var(--c-accent))]" />
      Other stimulant today (nicotine, energy drink, medication, etc.)
    </label>
  </div>

  <div class="flex flex-col gap-2">
    <p class="text-sm text-body">How alert do you feel?</p>
    <div class="flex gap-2">
      {#each alertOpts as [val, lbl]}
        <button class="flex-1 rounded border px-3 py-1.5 text-sm transition-colors {alertness === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
          on:click={() => (alertness = alertness === val ? null : val)}>{lbl}</button>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <p class="text-sm text-body">Mood</p>
    <div class="flex gap-2">
      {#each moodOpts as [val, lbl]}
        <button class="flex-1 rounded border px-3 py-1.5 text-sm transition-colors {mood === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
          on:click={() => (mood = mood === val ? null : val)}>{lbl}</button>
      {/each}
    </div>
  </div>

  <!-- Optional tags: grouped to avoid overload. Tap a group to expand, tap tags to toggle. -->
  <div class="flex flex-col gap-2">
    <p class="text-sm text-body">Tags <span class="text-muted">(optional - anything affecting today)</span></p>
    <!-- quick row: your recent tags, one tap; the full set lives under "more" -->
    <div class="flex flex-wrap gap-1">
      {#each quickTags as slug}
        <button type="button"
          class="rounded-full border px-2.5 py-0.5 text-xs {selectedTags.has(slug) ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
          on:click={() => toggleTag(slug)}>{TAG_LABEL.get(slug)}</button>
      {/each}
      <button type="button" class="rounded-full border border-edge px-2.5 py-0.5 text-xs text-muted hover:text-body"
        on:click={() => (moreTags = !moreTags)}>{moreTags ? 'less' : 'more…'}</button>
    </div>
    {#if selectedTags.size > 0}
      <div class="flex flex-wrap gap-1">
        {#each TAG_GROUPS as g}
          {#each g.tags.filter((t) => selectedTags.has(t.slug)) as t}
            <button class="rounded-full border border-accent bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
              on:click={() => toggleTag(t.slug)}>{t.label} ✕</button>
          {/each}
        {/each}
      </div>
    {/if}
    {#if moreTags}
    <div class="flex flex-col gap-1">
      {#each TAG_GROUPS as g}
        <div class="border border-edge">
          <button class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-muted hover:text-body"
            on:click={() => (openGroup = openGroup === g.key ? null : g.key)}>
            <span>{g.label}</span>
            <span class="text-xs">{openGroup === g.key ? '−' : '+'}</span>
          </button>
          {#if openGroup === g.key}
            <div class="flex flex-wrap gap-1.5 border-t border-edge p-2">
              {#each g.tags as t}
                <button class="rounded-full border px-2.5 py-1 text-xs transition-colors {selectedTags.has(t.slug) ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
                  on:click={() => toggleTag(t.slug)}>{t.label}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    {/if}
  </div>

  <!-- Session note: free-text "how/why I feel today". Private to the user. -->
  <div class="flex flex-col gap-2">
    <p class="text-sm text-body">Session note <span class="text-muted">(optional, private)</span></p>
    <textarea bind:value={note} rows="2" maxlength="500"
      placeholder="How do you feel today? Anything you want to remember about this session…"
      class="field text-sm"></textarea>
  </div>

  <div class="flex items-center justify-end pt-2">
    <button class="btn-primary" on:click={submit} disabled={saving}>{saving ? 'Saving…' : 'Start practice →'}</button>
  </div>
</div>
