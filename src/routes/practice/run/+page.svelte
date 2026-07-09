<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import SpatialFigure from '$lib/components/SpatialFigure.svelte';
  import SessionContextForm from '$lib/components/SessionContextForm.svelte';
  import Loader from '$lib/components/Loader.svelte';
  import AmbientSound from '$lib/components/AmbientSound.svelte';
  import ReportInconsistency from '$lib/components/ReportInconsistency.svelte';
  import { tapFeedback } from '$lib/native';

  export let data;
  const showDebug: boolean = data.showDebug;

  const SESSION_LENGTH = data.sessionLength ?? 10;   // user-configurable bounded session

  const GET_READY_MS = 600;          // breath before a challenge appears (not snappy/instant)


  type Figure = { cells: number[][]; accentIdx: number };
  type PromptData = {
    expression?: string; sequence?: number[]; instruction?: string;
    digits?: string; displayMs?: number; mode?: 'forward' | 'reverse';
    block?: string[]; symbols?: string; target?: string; grid?: number;
    prompt?: Figure | null; options?: Figure[] | string[]; stimulus?: string;
    stimulusColor?: string;
    timeMs?: number; listKey?: string; constraint?: string;
    language?: string; showAxis?: boolean;
    start?: number; allowed?: string[]; hint?: string;
  };
  type Challenge = {
    attemptId: string; category: string; categoryName: string;
    challengeType?: string;
    level: number; rendererType: string; promptData: PromptData;
  };
  type VocabEntry = { word: string; definition: string };
  type Result = {
    correct: boolean; correctAnswer: string; score: number; speed: string;
    level: number; nextLevel: number;
    rating: {
      value: number; before: number; delta: number;
      percentile: number | null; poolSize: number; status: string;
      confidence: string; provisional: boolean; attempts: number;
    };
    leveledUp: boolean; newRecordRating: boolean; peakRating: number; maxLevel: number;
    fluencyValidCount: number | null;
    fluencyWords: { w: string; ok: boolean; fuzzy: boolean }[] | null;
    vocab?: { prompt: VocabEntry | null; answer: VocabEntry | null } | null;
  };

  let challenge: Challenge | null = null;
  let answer = '';
  let yourAnswerDisplay = '';   // what the user submitted, for the feedback comparison
  let result: Result | null = null;
  // phases: getready (600ms beat) -> memorize (mem only) -> answering -> feedback (manual next)
  //         levelup (confirm question pending) -> sessiondone
  // The pre-session questionnaire is a per-SESSION gate: if the current session is already in
  // progress (e.g. returning from a Retention/Reaction hand-off), skip straight to the next
  // challenge instead of re-asking. One session, one ask.
  let phase: 'context' | 'loading' | 'getready' | 'memorize' | 'answering' | 'feedback' | 'sessiondone' | 'error' =
    data.sessionInProgress ? 'loading' : 'context';
  onMount(() => {
    if (!data.sessionInProgress) return;
    // Returning mid-session: if the module hand-off was the session's final step, close out
    // instead of serving an extra challenge past the bounded length.
    if (answeredCount >= SESSION_LENGTH) { phase = 'sessiondone'; return; }
    fetchNext();
  });
  let errorMsg = '';
  let shownAt = 0;
  // Phase A micro-signals (data-resolution plan): hesitation, edit trace, per-word fluency timing.
  let firstInputMs: number | null = null;
  let editsCount = 0;
  let wordTimes: number[] = [];
  function resetMicro() { firstInputMs = null; editsCount = 0; wordTimes = []; }
  let inputEl: HTMLInputElement;
  let flashClass = '';
  // Counts toward the bounded session. Resumes from the server when returning mid-session (e.g.
  // after a Retention/Reaction hand-off), so progress continues instead of restarting at 1.
  let answeredCount = data.sessionAnswered ?? 0;
  let memorizeTimer: ReturnType<typeof setTimeout> | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;
  let autoTick: ReturnType<typeof setInterval> | null = null;
  let autoProgress = 0;             // 0..100 fill of the auto-advance bar
  const AUTO_ADVANCE_MS = 4000;       // pause to read feedback before the next challenge (was 2600)
  const AUTO_ADVANCE_MS_MISS = 6000;  // longer on a miss - there's a correct answer to actually read

  // level-up confirm flow
  let pendingLevelUp = false;       // next fetched challenge is a confirm question
  let confirmingLevelUp = false;    // currently showing a confirm question
  let levelUpCategory: string | null = null;
  let levelUpToLevel = 0;
  let leveledUpConfirmed = false;   // show the celebration banner

  // "in the zone" meter - rolling sharpness across the session (0..100)
  let zone = 0;
  let zoneStreak = 0;

  // fluency (generate-many) state
  let fluencyWords: string[] = [];
  let fluencyInput = '';
  let fluencyRemainingMs = 0;
  let fluencyTimer: ReturnType<typeof setInterval> | null = null;

  const categoryParam = () => $page.url.searchParams.get('category');

  function clearTimers() {
    if (memorizeTimer) { clearTimeout(memorizeTimer); memorizeTimer = null; }
    if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; }
    if (fluencyTimer) { clearInterval(fluencyTimer); fluencyTimer = null; }
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (autoTick) { clearInterval(autoTick); autoTick = null; }
  }

  // After feedback, fill a bar over the dwell time then advance automatically - no click needed.
  // The manual button still works for anyone who wants to go faster (Enter / click). A miss gets a
  // longer dwell, since there's a correct answer (and the user's own answer) to actually read.
  function startAutoAdvance() {
    // Hold on a vocabulary lesson: a missed synonym/antonym shows definitions, and the user
    // should read them and click Next deliberately - never be whisked onward automatically.
    if (result && !result.correct && result.vocab && (result.vocab.prompt || result.vocab.answer)) return;
    const dwell = result && !result.correct ? AUTO_ADVANCE_MS_MISS : AUTO_ADVANCE_MS;
    autoProgress = 0;
    const start = performance.now();
    autoTick = setInterval(() => {
      autoProgress = Math.min(100, ((performance.now() - start) / dwell) * 100);
    }, 40);
    autoTimer = setTimeout(() => { clearTimers(); advance(); }, dwell);
  }

  function startAnswering() {
    phase = 'answering';
    shownAt = performance.now();
    resetMicro();
    requestAnimationFrame(() => inputEl?.focus());
  }

  function beginChallengeDisplay() {
    if (challenge?.rendererType === 'fluency_list') {
      startFluency();
      return;
    }
    if (challenge?.rendererType === 'memory_recall') {
      // brief get-ready beat, THEN show the stimulus, THEN allow answering
      phase = 'getready';
      readyTimer = setTimeout(() => {
        phase = 'memorize';
        memorizeTimer = setTimeout(startAnswering, challenge?.promptData.displayMs ?? 3000);
      }, GET_READY_MS);
    } else {
      // brief get-ready beat before the challenge appears, so it doesn't snap in
      phase = 'getready';
      readyTimer = setTimeout(startAnswering, GET_READY_MS);
    }
  }

  function startFluency() {
    fluencyWords = [];
    fluencyInput = '';
    phase = 'answering';
    shownAt = performance.now();
    resetMicro();
    const total = challenge?.promptData.timeMs ?? 30000;
    fluencyRemainingMs = total;
    requestAnimationFrame(() => inputEl?.focus());
    if (fluencyTimer) clearInterval(fluencyTimer);
    fluencyTimer = setInterval(() => {
      fluencyRemainingMs -= 250;
      if (fluencyRemainingMs <= 0) {
        fluencyRemainingMs = 0;
        submitFluency();
      }
    }, 250);
  }

  function addFluencyWord() {
    // Accept all natural input styles. Commas are the unambiguous separator, so if the input has
    // any comma we split ONLY on commas - that preserves legitimate multi-word answers like
    // "ice cream" or "cutting board" when the user comma-separates ("ice cream, olive oil").
    // If there are no commas, we split on whitespace so "pizza pasta burger" still works (at the
    // cost of splitting a space-only multi-word entry - acceptable, since comma-separation is the
    // documented way to enter phrases). Each token is trimmed, lowercased, de-duplicated.
    const hasComma = fluencyInput.includes(',');
    const tokens = fluencyInput
      .split(hasComma ? ',' : /\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    if (tokens.length > 0) {
      const next = [...fluencyWords];
      const tNow = Math.round(performance.now() - shownAt);
      for (const t of tokens) {
        if (!next.includes(t)) { next.push(t); wordTimes = [...wordTimes, tNow]; }
      }
      fluencyWords = next;
    }
    fluencyInput = '';
  }

  function onFluencyKeydown(e: KeyboardEvent) {
    // Enter or comma commit what's typed (addFluencyWord splits multi-token input). Space no longer
    // force-commits, so multi-word phrases ("ice cream") can be typed; the split handles the rest on
    // Enter, on "Done early", or on timer expiry. A trailing comma also commits via this handler.
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFluencyWord();
    }
  }

  function onFluencyInput() {
    // Live-commit on COMMA so pasted or run-together comma input ("food1, food2, food3" or
    // "food1,food2,food3") splits into chips immediately instead of waiting for Enter. Everything up
    // to the last comma is complete; the fragment after the last comma stays in the box as the
    // in-progress word. We do NOT commit on a trailing space - space is deliberately allowed mid-entry
    // so multi-word phrases ("ice cream", "olive oil") can be typed; those commit on comma/Enter/Done/
    // timer. Whitespace-separated lists still split correctly at submit time via addFluencyWord.
    const val = fluencyInput;
    if (val.includes(',')) {
      const lastComma = val.lastIndexOf(',');
      const complete = val.slice(0, lastComma);
      const pending = val.slice(lastComma + 1);
      fluencyInput = complete;
      addFluencyWord();          // splits + commits everything before the last comma
      fluencyInput = pending.replace(/^\s+/, '');
    }
  }

  function onFluencyPaste(e: ClipboardEvent) {
    // Pasting a list ("food1 food2 food3" or "food1, food2, food3") should split immediately. We take
    // over the paste, merge it with whatever's already typed, commit all complete tokens, and leave
    // any trailing fragment (text after the last separator) in the box. Whitespace IS a valid
    // separator on paste, since a pasted blob is a finished list, not something being typed.
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text) return;
    e.preventDefault();
    const combined = (fluencyInput + ' ' + text).trim();
    // split on commas and whitespace alike for the pasted blob
    const tokens = combined.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tokens.length > 0) {
      const next = [...fluencyWords];
      for (const t of tokens) if (!next.includes(t)) next.push(t);
      fluencyWords = next;
    }
    fluencyInput = '';
  }

  function submitFluency() {
    if (fluencyTimer) { clearInterval(fluencyTimer); fluencyTimer = null; }
    if (phase !== 'answering') return;
    addFluencyWord(); // capture any pending word
    submitValue(JSON.stringify(fluencyWords));
  }

  async function fetchNext(opts?: { forCategory?: string; isConfirm?: boolean }) {
    phase = 'loading';
    result = null;
    resultSubmitted = false;
    answer = '';
    flashClass = '';
    leveledUpConfirmed = false;
    clearTimers();
    confirmingLevelUp = !!opts?.isConfirm;
    try {
      // A hang must never be an eternal spinner: abort after 15s and surface the error UI.
      const ac = new AbortController();
      const killer = setTimeout(() => ac.abort(), 15000);
      const res = await fetch('/api/practice/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          category: opts?.forCategory ?? categoryParam() ?? undefined,
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          tzOffsetMin: new Date().getTimezoneOffset(),
          pulse: data.isPulse === true ? true : undefined
        })
      });
      clearTimeout(killer);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not load a challenge.');
      // Mixed run may hand off to a dedicated module (Retention / Reaction) so those domains are
      // genuinely part of the mix. Navigate there with inmix=1 so the module returns to the run
      // when its burst is done, keeping the session continuous from the user's side.
      if (d.handoff === 'retention') { goto('/practice/retention?inmix=1'); return; }
      if (d.handoff === 'reaction') { goto('/practice/reaction?inmix=1'); return; }
      challenge = d;
      beginChallengeDisplay();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Something went wrong.';
      phase = 'error';
    }
  }

  function updateZone(r: Result) {
    // sharp = correct AND not slow. Streaks build the meter; a miss cools it.
    const sharp = r.correct && r.speed !== 'slow';
    if (sharp) {
      zoneStreak += 1;
      zone = Math.min(100, zone + 14 + zoneStreak * 2);
    } else if (r.correct) {
      zone = Math.min(100, zone + 4);
    } else {
      zoneStreak = 0;
      zone = Math.max(0, zone - 28);
    }
  }

  async function submitValue(value: string) {
    if (!challenge || phase !== 'answering' || value === '') return;
    // Remember what the user actually answered, so the feedback can show "you said X, answer was Y".
    // For multiple choice the submitted value is the option index - resolve it to the option text.
    if (challenge.promptData?.options && Array.isArray(challenge.promptData.options)) {
      const i = Number(value);
      const opt = challenge.promptData.options[i];
      // text option -> show text; visual option (object) -> show the option number the user picked
      yourAnswerDisplay = typeof opt === 'string' && opt !== '' ? opt
        : (Number.isFinite(i) ? `option ${i + 1}` : value);
    } else if (isFluency) {
      yourAnswerDisplay = fluencyWords.join(', ');
    } else {
      yourAnswerDisplay = value;
    }
    resultSubmitted = true;   // this attempt is being answered; don't abandon it on leave
    const clientElapsedMs = Math.round(performance.now() - shownAt);
    phase = 'feedback';
    feedbackShownAt = performance.now();   // start the dwell window for Enter-to-advance
    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: challenge.attemptId, answer: value, clientElapsedMs, inputMethod: lastInputMethod,
          firstInputMs, editsCount, wordTimes: wordTimes.length > 0 ? wordTimes : undefined
        })
      });
      const r = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) throw new Error(r.error ?? 'Could not submit your answer.');
      result = r;
      flashClass = r.correct ? 'flash-ok' : 'flash-bad';
      tapFeedback(r.correct); // subtle haptic on native; no-op on web
      updateZone(r);

      if (confirmingLevelUp) {
        // this WAS the confirm question. Aced (correct & not slow) => celebrate.
        confirmingLevelUp = false;
        if (r.correct && r.speed !== 'slow') {
          leveledUpConfirmed = true;
        }
        // The confirm question doesn't count toward session length. If the bounded session
        // is already complete, end here - do NOT auto-advance (that fetched a fleeting extra
        // challenge before sessiondone). Otherwise auto-advance to the next normal question.
        if (answeredCount >= SESSION_LENGTH) {
          // let the celebration feedback show, then the manual button reads "Finish session"
        } else {
          startAutoAdvance();
        }
        return;
      }

      answeredCount += 1;

      // queue a confirm question if they leveled up (and session isn't over)
      if (r.leveledUp && answeredCount < SESSION_LENGTH) {
        pendingLevelUp = true;
        levelUpCategory = r.level !== r.nextLevel ? challenge.category : null;
        levelUpToLevel = r.nextLevel;
      }

      // Auto-advance ONLY for an ordinary next question. A pending level-up check is a
      // deliberate "prove it" moment - it must be triggered by the user, never auto-skipped
      // into (which looked like the question switching on its own before you could answer).
      if (!pendingLevelUp) {
        startAutoAdvance();
      }
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Something went wrong.';
      phase = 'error';
    }
  }

  const submitText = () => submitValue(answer.trim());
  const chooseOption = (i: number) => submitValue(String(i));

  function onAnswerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submitText();
  }

  // After feedback, the user advances manually (Next). This is where the
  // bounded session, the level-up confirm, and the celebration are sequenced.
  let advancing = false;   // guard: Enter and the auto-advance timer can both call advance()
  let feedbackShownAt = 0; // when the current feedback appeared (dwell guard for Enter)

  // Track how the user is answering (keyboard vs touch vs mouse) - a real timing confound we want
  // to be able to control for in analysis. Updated on each interaction, sent with the answer.
  let lastInputMethod = 'unknown';
  function noteInput(kind: string) { lastInputMethod = kind; }
  // hesitation: ms from answering-start to the FIRST input of any kind; edits: deletions while answering
  function trackMicroKey(e: KeyboardEvent) {
    if (phase !== 'answering' || shownAt <= 0) return;
    if (firstInputMs === null) firstInputMs = Math.round(performance.now() - shownAt);
    if (e.key === 'Backspace' || e.key === 'Delete') editsCount += 1;
  }
  function trackMicroPointer() {
    if (phase !== 'answering' || shownAt <= 0) return;
    if (firstInputMs === null) firstInputMs = Math.round(performance.now() - shownAt);
  }

  // "Not this category" - two scopes, both available AT the question and AFTER the answer:
  //  - session: mute it for the remainder of this session (a mood, not a preference)
  //  - forever: the enabled-categories preference (same as the Practice-page toggle)
  // Skipping at question time also closes the pending attempt as status='skipped', which keeps
  // its local-time context - avoidance is a pattern the instrument can honestly mine later.
  let skippingCategory = false;
  async function skipCategory(scope: 'session' | 'forever' | 'reduce') {
    if (!challenge || skippingCategory) return;
    if (scope === 'forever' && !confirm(`Stop showing ${challenge.categoryName} entirely? You can re-enable it anytime in Practice.`)) return;
    skippingCategory = true;
    try {
      await fetch('/api/practice/skip-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: challenge.category, scope })
      });
    } catch {
      // best-effort; worst case the category appears once more
    }
    skippingCategory = false;
    // move on immediately - at question time this replaces answering; after the answer it
    // simply advances (the mute applies from the next pick either way)
    if (phase === 'feedback') advance();
    else { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } fetchNext(); }
  }

  // Vocabulary learning: on a MISS in synonym/antonym challenges, show both words' definitions and
  // hold (cancel auto-advance) so the user actually reads them before clicking Next.
  $: showVocabLesson = !!(result && phase === 'feedback' && !result.correct && result.vocab && (result.vocab.prompt || result.vocab.answer));

  function advance() {
    if (advancing) return;
    advancing = true;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (autoTick) { clearInterval(autoTick); autoTick = null; }
    if (pendingLevelUp) {
      pendingLevelUp = false;
      advancing = false;
      fetchNext({ forCategory: levelUpCategory ?? undefined, isConfirm: true });
      return;
    }
    if (answeredCount >= SESSION_LENGTH) {
      phase = 'sessiondone';
      advancing = false;
      return;
    }
    advancing = false;
    fetchNext();
  }

  // global Enter to advance during feedback
  function onWindowKeydown(e: KeyboardEvent) {
    if (phase === 'feedback' && e.key === 'Enter') {
      e.preventDefault();
      // Don't let the SAME Enter that submitted the answer also advance: ignore key
      // auto-repeat, and require a brief dwell on feedback so a held/double Enter can't
      // flash feedback for one frame and skip to the next question ("extra answer" blink).
      if (e.repeat) return;
      if (performance.now() - feedbackShownAt < 350) return;
      advance();
    }
  }

  function continueSession() {
    answeredCount = 0; // a new bounded block
    fetchNext();
  }
  function endSession() {
    clearTimers();
    goto('/practice/summary');
  }

  // The pre-session questionnaire is the start gate; the session begins when it's
  // submitted or skipped (anonymous users get an anon account via the save endpoint).
  function beginSession() {
    phase = 'loading';
    fetchNext();
  }

  // If the user leaves while a challenge is still open (served but not answered), tell the server to
  // mark it abandoned so it isn't left pending forever. Best-effort via sendBeacon (survives unload).
  let resultSubmitted = false;
  function abandonIfOpen() {
    if (!challenge?.attemptId) return;
    if (phase !== 'answering' && phase !== 'getready' && phase !== 'memorize') return;
    if (resultSubmitted) return;
    try {
      const body = JSON.stringify({ attemptId: challenge.attemptId });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/practice/abandon', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/practice/abandon', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
      }
    } catch {
      // best-effort
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', abandonIfOpen);
    window.addEventListener('pagehide', abandonIfOpen);
  }

  onDestroy(() => {
    clearTimers();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', abandonIfOpen);
      window.removeEventListener('pagehide', abandonIfOpen);
    }
    abandonIfOpen(); // client-side navigation away
  });

  $: isMemory = challenge?.rendererType === 'memory_recall';
  $: isSvgChoice = challenge?.rendererType === 'multiple_choice_svg';
  $: isTextChoice = challenge?.rendererType === 'multiple_choice_text';
  $: isTwoChoice = challenge?.rendererType === 'two_choice';
  $: isFluency = challenge?.rendererType === 'fluency_list';
  $: isPlanning = challenge?.rendererType === 'planning_sequence';
  $: anyChoice = isSvgChoice || isTextChoice || isTwoChoice;
  $: blockCols = challenge?.promptData.block ? challenge.promptData.block[0].split(' ').length : 0;
  $: dotMask = challenge?.promptData.digits
    ? Array((challenge.promptData.digits ?? '').replace(/\s+/g, '').length).fill('·').join(' ')
    : '';
  $: levelReason = !result
    ? ''
    : (() => {
        const from = result.level, to = result.nextLevel;
        if (to > from) return result.speed === 'fast' ? 'quick and right - level up' : 'right - level up';
        if (to < from) return 'stepping down to find your level';
        if (result.correct && result.speed === 'slow') return 'right, unhurried - holding level';
        return 'holding level';
      })();
  $: progressLabel = confirmingLevelUp ? 'level-up check' : `${Math.min(answeredCount + (phase === 'feedback' ? 0 : 1), SESSION_LENGTH)} / ${SESSION_LENGTH}`;

  // Focus the feedback-phase Next button when it appears, so Enter advances. An action
  // instead of the autofocus attribute: same UX, none of autofocus's page-load a11y issues
  // (this fires on a user-initiated phase change, not on page load).
  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  // keyboard digit selection for choice questions (1-9)
  function onChoiceKeydown(e: KeyboardEvent) {
    if (phase !== 'answering' || !anyChoice || !challenge?.promptData.options) return;
    const n = parseInt(e.key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= (challenge.promptData.options as unknown[]).length) {
      chooseOption(n - 1);
    }
  }
</script>

<svelte:window on:keydown={onWindowKeydown} on:keydown={onChoiceKeydown} on:keydown={(e) => { noteInput('keyboard'); trackMicroKey(e); }} on:pointerdown={(e) => { noteInput(e.pointerType === 'touch' ? 'touch' : 'mouse'); trackMicroPointer(); }} />
<svelte:head><title>Practice - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 pt-4 sm:pt-10">
  {#if phase === 'context'}
    <SessionContextForm askDaily={data.askDaily} askNap={data.askNap} on:done={beginSession} />
  {:else}
  <!-- top bar: category/level, progress, zone, end -->
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p class="label">
        {challenge ? challenge.categoryName : 'Practice'} ·
        level <span class="font-mono">{challenge?.level ?? '-'}</span>
      </p>
      <div class="flex items-baseline gap-3 sm:gap-4">
        <span class="label">{progressLabel}</span>
        <AmbientSound />
        <button on:click={endSession} class="text-sm text-muted hover:text-body">End</button>
      </div>
    </div>
    <!-- in the zone meter -->
    <div class="flex items-center gap-2">
      <span class="label shrink-0 {zone >= 70 ? 'text-accent' : ''}">in the zone</span>
      <div class="h-1 flex-1 bg-edge">
        <div class="h-1 transition-all duration-500 {zone >= 70 ? 'bg-accent' : 'bg-accent/50'}" style="width: {zone}%"></div>
      </div>
    </div>
  </div>

  {#if phase === 'sessiondone'}
    <div class="panel flex min-h-[300px] flex-col items-center justify-center gap-6 p-8 text-center">
      {#if data.isPulse}
        <p class="label">Pulse complete</p>
        <p class="font-mono text-4xl">{data.daysPracticed}<span class="text-muted text-2xl"> days practiced</span></p>
        <p class="max-w-sm text-sm text-muted">Ninety seconds, measured and counted. Every day you show up adds a point to your stream - there is no chain to break.</p>
        <div class="flex flex-wrap justify-center gap-3">
          <a class="btn-primary" href="/stats">See your stream</a>
          <a class="btn" href="/practice/run">Full session</a>
        </div>
      {:else}
        <p class="label">Regular session complete</p>
        <p class="font-mono text-4xl">{SESSION_LENGTH}<span class="text-muted text-2xl"> done</span></p>
        <p class="max-w-sm text-sm text-muted">That's a focused set. You can keep going, review what you just did, or stop here - all of it counts.</p>
        <div class="flex flex-wrap justify-center gap-3">
          <button class="btn-primary" on:click={continueSession}>Keep practicing</button>
          <a class="btn" href="/practice/summary">See summary</a>
          <a class="btn" href="/stats">Stats</a>
        </div>
      {/if}
    </div>
  {:else}
    <div class="panel relative flex min-h-[320px] flex-col items-center justify-center gap-8 p-6 sm:p-8 {flashClass}">
      {#if phase === 'loading'}
        <div class="flex min-h-[240px] items-center justify-center">
          <Loader />
        </div>
      {:else if phase === 'error'}
        <div class="flex flex-col items-center gap-4 text-center">
          <p class="text-bad">{errorMsg}</p>
          <div class="flex gap-3">
            <button class="btn" on:click={() => fetchNext()}>Try again</button>
            <a class="btn" href="/stats">Back to stats</a>
          </div>
        </div>
      {:else if phase === 'getready'}
        <div class="flex flex-col items-center gap-3">
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent"></span>
          </span>
          <p class="label text-muted">Get ready…</p>
        </div>
      {:else if challenge}
        {#if confirmingLevelUp && phase !== 'feedback'}
          <p class="label text-accent">Level-up check - prove the jump</p>
        {/if}

        <!-- prompt -->
        <div class="w-full text-center">
          {#if isPlanning}
            <p class="label mb-3">{challenge.promptData.instruction}</p>
            {#if challenge.promptData.kind === 'step_order'}
              <div class="mx-auto mb-3 flex max-w-md flex-col gap-2 text-left">
                {#each (challenge.promptData.steps ?? []) as st}
                  <button type="button" class="rounded border border-edge px-3 py-2 text-left text-sm text-body hover:border-accent"
                    on:click={() => { const letter = st.slice(0, 1); if (!answer.toUpperCase().includes(letter)) answer = answer ? answer + ', ' + letter : letter; }}>{st}</button>
                {/each}
              </div>
              <p class="text-xs text-muted">{challenge.promptData.hint}</p>
            {:else if challenge.promptData.kind === 'grid_path'}
              <div class="mb-3 flex justify-center">
                <div class="panel p-3">
                  {#each (challenge.promptData.rows ?? []) as row}
                    <div class="font-mono text-xl leading-relaxed tracking-[0.4em] sm:text-2xl">{#each row.split('') as ch}<span class={ch === 'S' ? 'text-accent' : ch === 'T' ? 'text-good' : ch === '#' ? 'text-body' : 'text-edge'}>{ch}</span>{/each}</div>
                  {/each}
                </div>
              </div>
              <div class="mb-3 flex flex-wrap justify-center gap-2">
                {#each ['U', 'D', 'L', 'R'] as mv}
                  <button type="button" class="rounded border border-edge px-4 py-1 font-mono text-sm text-muted hover:border-accent hover:text-accent"
                    on:click={() => { answer = answer && !/[,\s]$/.test(answer) ? answer + ', ' + mv : answer + mv; }}>{mv}</button>
                {/each}
              </div>
              <p class="text-xs text-muted">{challenge.promptData.hint}</p>
            {:else}
              <div class="mb-4 flex items-center justify-center gap-3 font-mono text-3xl sm:text-4xl">
                <span class="text-body">{challenge.promptData.start}</span>
                <span class="text-muted">→</span>
                <span class="text-accent">{challenge.promptData.target}</span>
              </div>
              <p class="label mb-2">Allowed steps</p>
              <div class="mb-3 flex flex-wrap justify-center gap-2">
                {#each (challenge.promptData.allowed ?? []) as op}
                  <button type="button" class="rounded border border-edge px-3 py-1 font-mono text-sm text-muted hover:border-accent hover:text-accent"
                    on:click={() => { answer = answer && !/[,\s]$/.test(answer) ? answer + ', ' + op : answer + op; }}>{op}</button>
                {/each}
              </div>
              <p class="text-xs text-muted">{challenge.promptData.hint}</p>
            {/if}
          {:else if isMemory}
            {#if phase === 'memorize'}
              <p class="label mb-4">Memorize</p>
              <p class="font-mono text-5xl tracking-[0.3em] sm:text-6xl">{challenge.promptData.digits}</p>
            {:else}
              <p class="label mb-4">{challenge.promptData.instruction}</p>
              <p class="font-mono text-5xl tracking-[0.3em] text-edge sm:text-6xl" aria-hidden="true">{dotMask}</p>
            {/if}
          {:else if isSvgChoice}
            <p class="label mb-5">{challenge.promptData.instruction}</p>
            {#if challenge.promptData.prompt}
              <div class="mb-6 flex justify-center">
                <div class="panel p-2">
                  <SpatialFigure
                    cells={challenge.promptData.prompt.cells}
                    accentIdx={challenge.promptData.prompt.accentIdx}
                    grid={challenge.promptData.grid ?? 4}
                    showAxis={challenge.promptData.showAxis ?? false}
                    size={104}
                  />
                </div>
              </div>
            {/if}
          {:else if isTextChoice || isTwoChoice}
            <p class="mb-2 text-lg leading-relaxed sm:text-xl">{challenge.promptData.instruction}</p>
            {#if challenge.promptData.stimulus}
              <p
                class="font-mono text-4xl font-bold tracking-wide sm:text-5xl"
                style={challenge.promptData.stimulusColor ? `color: ${challenge.promptData.stimulusColor}` : ''}
              >{challenge.promptData.stimulus}</p>
            {/if}
          {:else if challenge.promptData.block}
            <p class="label mb-4">{challenge.promptData.instruction}</p>
            <pre class="font-mono {blockCols > 11 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} leading-relaxed">{challenge.promptData.block.join('\n')}</pre>
          {:else if challenge.promptData.symbols}
            <p class="label mb-4">{challenge.promptData.instruction}</p>
            <p
              class="mx-auto max-w-md break-words font-mono leading-relaxed tracking-[0.18em] {challenge.promptData.symbols.length > 40 ? 'text-lg sm:text-xl' : challenge.promptData.symbols.length > 20 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}"
              style="word-break: break-all; overflow-wrap: anywhere;"
            >{challenge.promptData.symbols}</p>
          {:else if challenge.promptData.sequence}
            <p class="label mb-4">{challenge.promptData.instruction ?? 'What number comes next?'}</p>
            <p class="font-mono text-4xl tracking-wider sm:text-5xl">
              {challenge.promptData.sequence.join(', ') + ', '}<span class="text-accent">?</span>
            </p>
          {:else if isFluency}
            <p class="label mb-2">Generate as many as you can</p>
            <p class="text-2xl leading-relaxed sm:text-3xl">{challenge.promptData.instruction}</p>
          {:else if challenge.category === 'estimation'}
            <p class="label mb-3">Estimate - closest wins, no need to be exact</p>
            <p class="break-words text-2xl leading-relaxed sm:text-3xl" style="overflow-wrap: anywhere; word-break: break-word;">{challenge.promptData.instruction}</p>
          {:else}
            <p class="font-mono text-5xl tracking-wide sm:text-6xl">{challenge.promptData.expression}</p>
          {/if}
        </div>

        <!-- answer -->
        {#if isSvgChoice && challenge.promptData.options}
          <div class="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
            {#each challenge.promptData.options as opt, i}
              <button
                class="panel relative flex items-center justify-center p-2 transition-colors hover:border-accent disabled:opacity-60"
                disabled={phase !== 'answering'}
                on:click={() => chooseOption(i)}
                aria-label={`Option ${i + 1}`}
              >
                <span class="absolute left-1 top-1 font-mono text-xs text-muted">{i + 1}</span>
                <SpatialFigure cells={opt.cells} accentIdx={opt.accentIdx} grid={challenge.promptData.grid ?? 4} size={80} />
              </button>
            {/each}
          </div>
          <p class="text-xs text-muted">Click a tile, or press its number 1-{challenge.promptData.options.length}.</p>
        {:else if isTextChoice && challenge.promptData.options}
          <div class="flex w-full max-w-md flex-col gap-2">
            {#each challenge.promptData.options as opt, i}
              <button
                class="panel flex items-center gap-3 px-4 py-3 text-left text-body transition-colors hover:border-accent disabled:opacity-60"
                disabled={phase !== 'answering'}
                on:click={() => chooseOption(i)}
              >
                <span class="font-mono text-xs text-muted">{i + 1}</span>{opt}
              </button>
            {/each}
          </div>
          <p class="text-xs text-muted">Click, or press 1-{challenge.promptData.options.length}.</p>
        {:else if isTwoChoice && challenge.promptData.options}
          <div class="grid w-full max-w-md grid-cols-2 gap-3">
            {#each challenge.promptData.options as opt, i}
              <button
                class="btn-primary relative justify-center py-4 text-lg disabled:opacity-60"
                disabled={phase !== 'answering'}
                on:click={() => chooseOption(i)}
              >
                <span class="absolute left-2 top-1 font-mono text-xs opacity-60">{i + 1}</span>{opt}
              </button>
            {/each}
          </div>
          <p class="text-xs text-muted">Click, or press 1 / 2.</p>
        {:else if isPlanning}
          <div class="flex w-full max-w-md flex-col gap-3">
            <input
              bind:this={inputEl}
              bind:value={answer}
              on:keydown={onAnswerKeydown}
              disabled={phase !== 'answering'}
              autocomplete="off" spellcheck="false"
              placeholder={challenge.promptData.kind === 'step_order' ? 'the letters in order, e.g. C, A, D, B' : challenge.promptData.kind === 'grid_path' ? 'your moves, e.g. R, R, D, D' : 'your steps, e.g. *2, +3'}
              class="field text-center font-mono text-xl" aria-label="Your plan"
            />
            <button class="btn-primary" disabled={phase !== 'answering'} on:click={submitText}>Submit plan</button>
            <p class="text-center text-xs text-muted">No timer. Plan it out, then submit.</p>
          </div>
        {:else if isFluency}
          <div class="flex w-full max-w-md flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="label">{fluencyWords.length} given</span>
              <span class="label font-mono {fluencyRemainingMs <= 5000 ? 'text-bad' : ''}">{Math.ceil(fluencyRemainingMs / 1000)}s</span>
            </div>
            <div class="h-1 w-full bg-edge">
              <div class="h-1 bg-accent transition-all duration-200" style="width: {(fluencyRemainingMs / (challenge.promptData.timeMs ?? 30000)) * 100}%"></div>
            </div>
            <input
              bind:this={inputEl}
              bind:value={fluencyInput}
              on:keydown={onFluencyKeydown}
              on:input={onFluencyInput}
              on:paste={onFluencyPaste}
              disabled={phase !== 'answering'}
              autocomplete="off" spellcheck="false" placeholder="words · comma or Enter"
              class="field text-lg" aria-label="Your answer"
            />
            {#if fluencyWords.length > 0}
              <div class="flex flex-wrap gap-1.5">
                {#each fluencyWords as w}
                  <span class="rounded border border-edge px-2 py-0.5 text-sm text-muted">{w}</span>
                {/each}
              </div>
            {/if}
            <button class="btn" disabled={phase !== 'answering'} on:click={submitFluency}>Done early</button>
            <p class="text-center text-xs text-muted">Letter tasks are checked against an English dictionary (~275k words) - very rare words and proper nouns may not count. Category tasks check curated topic wordlists (EN) with plural and near-miss tolerance; a real but very obscure word may still not count.</p>
          </div>
        {:else if phase !== 'memorize' && phase !== 'getready'}
          <div class="flex w-full max-w-xs flex-col gap-3">
            <input
              bind:this={inputEl}
              bind:value={answer}
              on:keydown={onAnswerKeydown}
              disabled={phase !== 'answering'}
              inputmode={challenge.category === 'estimation' ? 'decimal' : 'numeric'}
              autocomplete="off" spellcheck="false" placeholder="answer"
              class="field text-center font-mono text-2xl" aria-label="Your answer"
            />
            <button class="btn-primary" disabled={phase !== 'answering'} on:click={submitText}>Submit</button>
          </div>
        {:else if phase === 'memorize'}
          <p class="text-sm text-muted">The input appears when the digits disappear.</p>
        {/if}

        <!-- the same two escape hatches AT the question, not only after the answer: a skip here
             replaces answering and is recorded as one (status='skipped', with its local time) -->
        {#if challenge && (phase === 'answering' || phase === 'memorize')}
          <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" disabled={skippingCategory} on:click={() => skipCategory('session')}>Skip {challenge.categoryName} this session</button>
            <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" disabled={skippingCategory} on:click={() => skipCategory('reduce')}>Show less often</button>
            <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" disabled={skippingCategory} on:click={() => skipCategory('forever')}>Don't show again</button>
          </div>
        {/if}

        <!-- feedback + manual advance -->
        {#if result && phase === 'feedback'}
          <div class="flex w-full flex-col items-center gap-3">
            {#if leveledUpConfirmed}
              <p class="text-center text-lg text-accent">Nice - you leveled up.</p>
            {/if}
            <p class="text-center text-sm">
              {#if result.fluencyValidCount != null}
                <span class="text-ok">{result.fluencyValidCount} valid</span>
                <span class="text-muted"> answers</span>
              {:else if result.correct}
                <span class="text-ok">✓ Correct</span>
              {:else}
                <span class="text-bad">✗ Incorrect</span>
                {#if result.correctAnswer}
                  <span class="text-muted"> · answer: </span><span class="font-mono text-body">{result.correctAnswer}</span>
                {/if}
              {/if}
              {#if levelReason}<span class="text-muted"> · {levelReason}</span>{/if}
              {#if result.newRecordRating}<span class="text-accent"> · new personal best</span>{/if}
            </p>
            {#if result.fluencyWords && result.fluencyWords.length > 0}
              <!-- Which words counted, visibly: green = counted, dimmed strike = didn't, ≈ = typo-tolerant match.
                   Makes the scoring legible at answer time instead of a bare count. -->
              <div class="flex max-w-md flex-wrap justify-center gap-1.5 self-center">
                {#each result.fluencyWords as fw}
                  <span class="rounded px-1.5 py-0.5 font-mono text-[11px] {fw.ok ? 'bg-ok/10 text-ok' : 'bg-edge/40 text-muted line-through'}" title={fw.dup ? 'already given (typo or variant of an earlier answer)' : ''}>{fw.w}{fw.dup ? ' · dup' : fw.fuzzy ? ' ≈' : ''}</span>
                {/each}
              </div>
            {/if}
            {#if !result.correct && yourAnswerDisplay && result.fluencyValidCount == null}
              <p class="-mt-1 text-center text-xs text-muted">you answered <span class="font-mono text-bad line-through">{yourAnswerDisplay}</span></p>
            {/if}
            {#if showDebug}
              <p class="font-mono text-xs text-muted">[score {result.score.toFixed(2)} · {result.speed} · {result.rating.before}→{result.rating.value} · peak {result.peakRating}]</p>
            {/if}

            {#if showVocabLesson && result.vocab}
              <div class="w-full max-w-md rounded border border-edge bg-surface/40 p-4 text-left">
                <p class="label mb-2 text-muted">Worth learning</p>
                {#if result.vocab.prompt}
                  <p class="mb-2 text-sm"><span class="font-mono text-accent">{result.vocab.prompt.word}</span> <span class="text-muted">- {result.vocab.prompt.definition}</span></p>
                {/if}
                {#if result.vocab.answer}
                  <p class="text-sm"><span class="font-mono text-accent">{result.vocab.answer.word}</span> <span class="text-muted">- {result.vocab.answer.definition}</span></p>
                {/if}
              </div>
            {/if}

            <button class="btn-primary" on:click={advance} use:focusOnMount>
              {#if pendingLevelUp}Level-up question →{:else if answeredCount >= SESSION_LENGTH}Finish session →{:else}Next →{/if}
            </button>

            {#if showVocabLesson}
              <p class="text-xs text-muted">Take a moment - then continue when ready.</p>
            {:else if !pendingLevelUp && answeredCount < SESSION_LENGTH}
              <div class="h-0.5 w-32 overflow-hidden rounded bg-edge">
                <div class="h-full bg-accent/50 transition-none" style="width: {autoProgress}%"></div>
              </div>
              <p class="text-xs text-muted">advancing… or press Enter / click</p>
            {:else if pendingLevelUp}
              <p class="text-xs text-accent">You leveled up - ready for a harder one to confirm it? Press Enter when set.</p>
            {:else}
              <p class="text-xs text-muted">or press Enter</p>
            {/if}

            {#if challenge}
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" disabled={skippingCategory} on:click={() => skipCategory('session')}>Skip {challenge.categoryName} this session</button>
                <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" disabled={skippingCategory} on:click={() => skipCategory('reduce')}>Show less often</button>
                <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" disabled={skippingCategory} on:click={() => skipCategory('forever')}>Don't show again</button>
              </div>
            {/if}
          </div>
        {/if}
      {:else}
        <p class="text-muted">Preparing your next challenge…</p>
      {/if}
    </div>
  {/if}

  <div class="flex items-baseline justify-between gap-3 text-sm text-muted">
    <p>Take your time. A slow correct answer is still correct.</p>
    {#if challenge}
      <ReportInconsistency snapshot={{
        challengeId: challenge.id,
        category: challenge.categoryName,
        level: challenge.level,
        prompt: challenge.promptData?.instruction ?? challenge.promptData?.prompt ?? null,
        phase,
        yourAnswer: isFluency ? fluencyWords : answer
      }} />
    {/if}
  </div>
  {/if}
</div>
