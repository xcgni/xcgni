<script lang="ts">
  import { t } from '$lib/i18n/store';
  import { onMount, onDestroy } from 'svelte';
  export let data;
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { keepScreenAwake } from '$lib/native';

  // When launched from the mixed run (?inmix=1), the reaction run returns to /practice/run when
  // done, so Reaction Time is part of the mix without the user choosing to "switch" to it.
  const inMix = $page.url.searchParams.get('inmix') === '1';
  function returnToMix() { goto('/practice/run'); }

  // Two-stage: calibrate (measure your hardware floor) then trials. Result is a
  // BAND, never a single number - honest about hardware delay.
  type Stage = 'intro' | 'calibrating' | 'cal-wait' | 'cal-react' | 'cal-done'
             | 'trials' | 'trial-wait' | 'trial-react' | 'result' | 'too-soon';

  let stage: Stage = 'intro';
  const CAL_PROBES = 5;
  const TRIALS = 5;

  let calSamples: number[] = [];
  let trialSamples: number[] = [];
  let cueAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let refreshHz = 60;
  let result: { band: { fastMs: number; slowMs: number; widthMs: number }; calibrated: boolean; trials: number } | null = null;
  let calibration: { floorMs: number; uncertaintyMs: number } | null = null;

  function estimateRefresh(): Promise<number> {
    return new Promise((resolve) => {
      let last = performance.now();
      let count = 0;
      const deltas: number[] = [];
      function tick(now: number) {
        deltas.push(now - last); last = now; count++;
        if (count < 20) requestAnimationFrame(tick);
        else {
          deltas.sort((a, b) => a - b);
          const med = deltas[Math.floor(deltas.length / 2)];
          resolve(Math.round(1000 / med));
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function scheduleCue(next: Stage) {
    const wait = 1200 + Math.random() * 2500; // randomized to prevent anticipation
    timer = setTimeout(() => {
      cueAt = performance.now();
      stage = next;
    }, wait);
  }

  function startCalibration() {
    keepScreenAwake(true); // a dimming screen mid-measurement ruins the timing
    calSamples = [];
    stage = 'cal-wait';
    scheduleCue('cal-react');
  }

  function startTrials() {
    keepScreenAwake(true);
    trialSamples = [];
    stage = 'trial-wait';
    scheduleCue('trial-react');
  }

  // Keyboard support: Enter (or Space) acts as the tap, and advances between stages. Reacting by
  // keyboard is a legitimate input mode (often faster than a mouse) - the measurement is the same
  // cue->response interval either way.
  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.repeat) return; // holding the key must not machine-gun reactions
    e.preventDefault();
    if (stage === 'intro') startCalibration();
    else if (stage === 'cal-done') startTrials();
    else if (stage === 'result') {
      if (performance.now() - resultShownAt < 600) return; // still reacting rhythmically - let them read
      if (inMix) returnToMix(); else startTrials();
    }
    else onReact(); // wait/react stages: same as tapping (premature presses handled inside)
  }

  function onReact() {
    if (stage === 'cal-react') {
      calSamples = [...calSamples, performance.now() - cueAt];
      if (calSamples.length >= CAL_PROBES) finishCalibration();
      else { stage = 'cal-wait'; scheduleCue('cal-react'); }
    } else if (stage === 'trial-react') {
      trialSamples = [...trialSamples, performance.now() - cueAt];
      if (trialSamples.length >= TRIALS) finishTrials();
      else { stage = 'trial-wait'; scheduleCue('trial-react'); }
    } else if (stage === 'cal-wait' || stage === 'trial-wait') {
      // Reacted before the cue - discard and restart THE PHASE THAT WAS INTERRUPTED.
      // (The old recovery hardcoded calibration: a false start during trials either stalled
      // forever at the red text, or silently rerouted a calibrated user into re-calibration.)
      if (timer) clearTimeout(timer);
      const resume = stage;
      stage = 'too-soon';
      setTimeout(() => {
        if (stage !== 'too-soon') return; // user navigated away meanwhile
        if (resume === 'trial-wait') { stage = 'trial-wait'; scheduleCue('trial-react'); }
        else { stage = 'cal-wait'; scheduleCue('cal-react'); }
      }, 900);
    }
  }

  async function finishCalibration() {
    const res = await fetch('/api/reaction/calibrate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ samples: calSamples, refreshHz })
    });
    const d = await res.json();
    calibration = d.calibration ?? null;
    stage = 'cal-done';
  }

  let autoReturnTimer: ReturnType<typeof setTimeout> | null = null;
  let resultShownAt = 0; // guard: ignore key input right after the result appears (rhythmic tapping)

  async function finishTrials() {
    const res = await fetch('/api/reaction/trial', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ measuredMs: trialSamples })
    });
    result = await res.json();
    stage = 'result';
    keepScreenAwake(false);
    resultShownAt = performance.now();
    // In-mix: show the result briefly, then return to the run on its own - a seamless step of the
    // session, not a destination. The button remains for anyone who wants to go sooner.
    if (inMix) autoReturnTimer = setTimeout(returnToMix, 4000);
  }

  onMount(async () => {
    refreshHz = await estimateRefresh();
    // In-mix: start immediately - the user was handed here by the run, don't make them click an
    // intro button. Calibrate once, ever: if a calibration is already stored, a burst is TRIALS
    // ONLY; only an uncalibrated user gets the quick calibration first.
    if (inMix && stage === 'intro') {
      if (data.calibrated) startTrials();
      else startCalibration();
    }
  });
  onDestroy(() => {
    keepScreenAwake(false);
    if (autoReturnTimer) clearTimeout(autoReturnTimer); if (timer) clearTimeout(timer); });
</script>

<svelte:head><title>Reaction Time - Excogni</title></svelte:head>
<svelte:window on:keydown={onKeydown} />

<div class="mx-auto flex max-w-2xl flex-col gap-6 pt-4 sm:pt-10">
  <div class="flex items-baseline justify-between">
    <a href={inMix ? '/practice/run' : '/stats'} class="label text-muted hover:text-body">← {inMix ? $t('ret.backPlain') : $t('run.exit')}</a>
    <p class="label">{$t('rx.title')}</p>
  </div>

  {#if stage === 'intro'}
    <div class="panel flex flex-col items-start gap-4 p-6">
      <p class="text-sm text-muted">
        Reaction time is reported as a <span class="text-body">range</span>, not a single number -
        because your screen and input add a delay we can't know exactly. First we measure your
        hardware's floor with a few quick probes, which narrows the range. Then you do {TRIALS} trials.
        {$t('rx.intro')}</p>
      <p class="text-xs text-muted">Estimated display refresh: {refreshHz}Hz</p>
      <button class="btn-primary" on:click={startCalibration}>Calibrate ({CAL_PROBES} probes)</button>
    </div>
  {:else if stage === 'too-soon'}
    <div class="panel flex min-h-[300px] items-center justify-center p-8">
      <p class="text-bad">Too soon - wait for amber. Restarting…</p>
    </div>
  {:else if stage === 'cal-wait' || stage === 'trial-wait'}
    <button class="panel flex min-h-[300px] w-full items-center justify-center bg-surface p-8" on:click={onReact}>
      <p class="text-muted">{$t('rx.waitAmber')}</p>
    </button>
  {:else if stage === 'cal-react' || stage === 'trial-react'}
    <button class="flex min-h-[300px] w-full items-center justify-center p-8" style="background:rgb(var(--c-accent))" on:click={onReact}>
      <p class="text-xl font-bold text-ink">TAP NOW</p>
    </button>
    <p class="text-center text-xs text-muted">
      {stage === 'cal-react' ? `Probe ${calSamples.length + 1}/${CAL_PROBES}` : `Trial ${trialSamples.length + 1}/${TRIALS}`}
    </p>
  {:else if stage === 'cal-done'}
    <div class="panel flex flex-col items-start gap-4 p-6">
      <p class="label text-ok">Calibrated</p>
      {#if calibration}
        <p class="text-sm text-muted">
          {$t('rx.floor')} <span class="font-mono text-body">{calibration.floorMs}ms</span>
          with ±<span class="font-mono">{calibration.uncertaintyMs}ms</span> {$t('rx.residual')} uncertainty. That
          uncertainty sets how wide your reaction band will be - a tighter setup gives a tighter answer.
        </p>
      {/if}
      <button class="btn-primary" on:click={startTrials}>{$t('rx.startTrials',{n:TRIALS})}</button>
    </div>
  {:else if stage === 'result' && result}
    <div class="panel flex flex-col items-center gap-5 p-8 text-center">
      <p class="label">Your reaction time</p>
      <p class="font-mono text-4xl">
        <span class="text-accent">{result.band.fastMs}</span>
        <span class="text-muted text-2xl"> - </span>
        <span class="text-accent">{result.band.slowMs}</span>
        <span class="text-muted text-xl"> ms</span>
      </p>
      <p class="max-w-sm text-sm text-muted">
        Your true reaction time lies in this range. The width ({result.band.widthMs}ms) is the
        hardware uncertainty we can't remove - {result.calibrated ? 'narrowed by your calibration' : 'using default bounds (calibrate to narrow it)'}.
        We never collapse it to a single number, because that number would be partly fiction.
      </p>
      <div class="flex gap-3">
        {#if inMix}
          <button class="btn-primary" on:click={returnToMix}>{$t('ret.back')}</button>
          <span class="self-center text-xs text-muted">returning automatically…</span>
          <button class="btn" on:click={startTrials}>Again</button>
        {:else}
          <button class="btn-primary" on:click={startTrials}>Again</button>
          <a class="btn" href="/stats">Stats</a>
        {/if}
      </div>
    </div>
  {/if}

  <p class="text-center text-xs text-muted">
    Honest by design: a measured tap includes screen and input delay. We bound your true speed
    rather than pretend to know it exactly.
  </p>
</div>
