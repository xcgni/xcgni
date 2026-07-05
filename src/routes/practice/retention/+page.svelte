<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Loader from '$lib/components/Loader.svelte';
  export let data;

  // When launched from the mixed run (?inmix=1), this page runs a short BURST of cards and then
  // returns to /practice/run, so Retention is part of the mix without the user choosing to "switch".
  const inMix = $page.url.searchParams.get('inmix') === '1';
  const BURST_SIZE = 5;
  let burstDone = 0;

  function returnToMix() { goto('/practice/run'); }

  type Card = { cardId: string; deck: string; deckLabel: string; prompt: string; isNew: boolean; wasDue: boolean; answer: string | null };
  type Status = { dueNow: number; seen: number; mature: number; totalCards: number; dueReviews: number; mastery: number | null };
  type Grade = { correct: boolean; fuzzy: boolean; answer: string; note: string | null; countedAsMeasurement: boolean; mastery: number | null; rating: number | null };

  let card: Card | null = null;
  let status: Status | null = null;
  let phase: 'loading' | 'prompt' | 'reveal' | 'graded' | 'empty' | 'error' = 'loading';
  let answer = '';
  let shownAt = 0;
  let result: Grade | null = null;
  let errorMsg = '';
  let inputEl: HTMLInputElement;

  // deck picker: empty set = all decks. Only scopes NEW cards; due reviews always come.
  let chosenDecks = new Set<string>();
  let showPicker = false;
  function toggleDeck(slug: string) {
    if (chosenDecks.has(slug)) chosenDecks.delete(slug);
    else chosenDecks.add(slug);
    chosenDecks = chosenDecks;
  }

  async function fetchNext() {
    phase = 'loading';
    answer = '';
    result = null;
    try {
      const res = await fetch('/api/retention/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decks: [...chosenDecks] })
      });
      const d = await res.json();
      status = d.status;
      card = d.card;
      if (!card) { phase = 'empty'; return; }
      phase = 'prompt';
      shownAt = performance.now();
      requestAnimationFrame(() => inputEl?.focus());
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Something went wrong.';
      phase = 'error';
    }
  }

  // New cards: show the answer to learn (no grading). Due cards: grade recall.
  function reveal() {
    if (!card) return;
    if (card.isNew) { phase = 'reveal'; return; }
    grade();
  }

  async function grade() {
    if (!card) return;
    const elapsedMs = Math.round(performance.now() - shownAt);
    phase = 'graded';
    try {
      const res = await fetch('/api/retention/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardId: card.cardId, answer, elapsedMs })
      });
      result = await res.json();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Could not grade.';
      phase = 'error';
    }
  }

  // For a NEW card, after learning, mark it seen by grading with the shown answer
  // (counts as a first exposure; scheduling starts, not a measurement).
  async function learnt() {
    if (!card) return;
    // New cards are pure learning - record that it's been seen, then go straight to
    // the next card. No separate "Saved" confirmation screen (that was a redundant click).
    const cardId = card.cardId;
    phase = 'loading';
    try {
      await fetch('/api/retention/grade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardId, answer: '', elapsedMs: 0 })
      });
      advanceOrReturn();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Could not save.';
      phase = 'error';
    }
  }

  // Advance to the next card, or if we're in a mixed-run burst and have done our share, hand back
  // to the mix. Counts the card that just completed.
  function advanceOrReturn() {
    burstDone += 1;
    if (inMix && burstDone >= BURST_SIZE) { returnToMix(); return; }
    fetchNext();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (phase === 'prompt') reveal();
      else if (phase === 'reveal') learnt();
      else if (phase === 'graded') advanceOrReturn();
    }
  }

  onMount(fetchNext);
</script>

<svelte:head><title>Retention - Excogni</title></svelte:head>
<svelte:window on:keydown={onKeydown} />

<div class="mx-auto flex max-w-2xl flex-col gap-6 pt-4 sm:pt-10">
  <div class="flex items-baseline justify-between">
    <a href={inMix ? '/practice/run' : '/stats'} class="label text-muted hover:text-body">← {inMix ? 'Back to practice' : 'Exit'}</a>
    <div class="flex items-baseline gap-4">
      {#if status}
        <p class="label font-mono">
          {status.dueNow} due · {status.seen}/{status.totalCards} seen
          {#if status.mastery != null} · mastery {Math.round(status.mastery * 100)}%{/if}
        </p>
      {/if}
    </div>
  </div>

  <div class="-mt-2 flex flex-wrap items-center justify-between gap-3">
    <p class="label">Retention {card ? `· ${card.deckLabel}` : ''}{inMix ? ` · ${Math.min(burstDone + 1, BURST_SIZE)}/${BURST_SIZE}` : ''}</p>
    {#if !inMix && data.decks && data.decks.length > 1}
      <button
        class="flex items-center gap-2 rounded border border-edge bg-surface px-3 py-1.5 text-sm text-body transition-colors hover:border-accent"
        on:click={() => (showPicker = !showPicker)}
      >
        <span class="text-muted">Decks:</span>
        <span class="text-accent">{chosenDecks.size === 0 ? 'All' : `${chosenDecks.size} chosen`}</span>
        <span class="text-muted">{showPicker ? '▴' : '▾'}</span>
      </button>
    {/if}
  </div>

  {#if showPicker && data.decks}
    <div class="panel flex flex-col gap-2 p-4">
      <p class="text-xs text-muted">
        Pick interests to learn from. Cards already due for review still come up regardless -
        this only chooses which new cards you learn next.
      </p>
      <div class="flex flex-wrap gap-2">
        {#each data.decks as d}
          <button
            class="rounded border px-3 py-1 text-sm transition-colors {chosenDecks.has(d.slug)
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-edge text-muted hover:text-body'}"
            on:click={() => toggleDeck(d.slug)}
          >{d.label} <span class="text-xs opacity-60">{d.cards}</span></button>
        {/each}
      </div>
      <div class="flex gap-3 pt-1">
        {#if chosenDecks.size > 0}
          <button class="label text-muted hover:text-body" on:click={() => { chosenDecks = new Set(); }}>Clear</button>
        {/if}
        <button class="btn ml-auto" on:click={() => { showPicker = false; fetchNext(); }}>Apply</button>
      </div>
    </div>
  {/if}

  <div class="panel flex min-h-[320px] flex-col items-center justify-center gap-6 p-6 sm:p-8">
    {#if phase === 'loading'}
      <Loader size="sm" />
    {:else if phase === 'error'}
      <p class="text-bad">{errorMsg}</p>
      <button class="btn" on:click={fetchNext}>Try again</button>
    {:else if phase === 'empty'}
      <p class="label">All caught up</p>
      <p class="max-w-sm text-center text-sm text-muted">
        Nothing is due right now and you've seen every card. Retention is measured over days -
        come back later and the cards you learned will return as real recall tests.
      </p>
      {#if inMix}
        <button class="btn-primary" on:click={returnToMix}>Back to practice →</button>
      {:else}
        <a class="btn" href="/stats">Stats</a>
      {/if}
    {:else if card}
      {#if card.isNew}
        <p class="label text-accent">New - learn this</p>
      {:else if card.wasDue}
        <p class="label text-accent">Due - recall test</p>
      {:else}
        <p class="label">Review</p>
      {/if}

      <p class="text-center text-2xl leading-relaxed sm:text-3xl">{card.prompt}</p>

      {#if phase === 'prompt'}
        {#if card.isNew}
          <button class="btn-primary" on:click={reveal}>Show the answer</button>
        {:else}
          <div class="flex w-full max-w-xs flex-col gap-3">
            <input
              bind:this={inputEl} bind:value={answer}
              autocomplete="off" spellcheck="false" placeholder="your answer"
              class="field text-center text-xl"
            />
            <button class="btn-primary" on:click={grade}>Check</button>
          </div>
        {/if}
      {:else if phase === 'reveal'}
        <p class="text-center font-mono text-2xl text-accent">{card.answer ?? ''}</p>
        <p class="text-center text-xs text-muted">Just learn it - this isn't a test. It will come back as a real recall test when it's due.</p>
        <button class="btn-primary" on:click={learnt}>Got it - next</button>
      {:else if phase === 'graded' && result}
        <p class="text-center text-lg {result.correct ? 'text-ok' : 'text-bad'}">
          {result.correct ? '✓ Correct' : '✗ Not quite'}
        </p>
        {#if result.correct && result.fuzzy}
          <p class="text-center text-xs text-muted">Close enough - counted, though a clean spelling scores a touch higher.</p>
        {/if}
        {#if !result.correct}
          <p class="text-center font-mono text-xl text-accent">{result.answer}</p>
          {#if result.note}
            <p class="mx-auto max-w-md text-center text-sm text-muted">{result.note}</p>
          {/if}
        {/if}
        {#if result.countedAsMeasurement}
          <p class="text-center text-xs text-muted">This was a genuine recall test - it counts toward your retention score.</p>
        {:else}
          <p class="text-center text-xs text-muted">Still learning this one - scheduling it to return, not scoring it yet.</p>
        {/if}
        <button class="btn-primary" on:click={advanceOrReturn}>{inMix && burstDone + 1 >= BURST_SIZE ? 'Back to practice →' : 'Next →'}</button>
        <p class="text-xs text-muted">or press Enter</p>
      {/if}
    {/if}
  </div>

  <p class="text-center text-xs text-muted">
    Retention trains and measures at once. A card only scores you when it was genuinely due -
    forgetting something you just saw is part of learning, not a mark against you.
  </p>
</div>
