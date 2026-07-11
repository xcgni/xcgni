<script lang="ts">
  import { t, locale } from '$lib/i18n/store';
  export let data;
  $: current = data.current;
</script>

<svelte:head><title>Methodology - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 py-6 sm:gap-8 sm:py-8">
  <div class="flex flex-col gap-3">
    <p class="label text-accent">Methodology</p>
    <h1 class="text-2xl font-light">How a cognitive profile is computed - versioned, so it can be cited.</h1>
  {#if $locale !== 'en'}<p class="mt-2 text-xs text-muted">{$t('page.enOnly')}</p>{/if}
    <p class="text-sm leading-relaxed text-muted">
      Every score Excogni produces is stamped with the methodology version it was computed under. A
      version pins the scoring formulas, the rating algorithm and its constants, and which challenges
      count toward an official score. When any of these change in a way that affects a score, we mint a
      <em>new</em> version rather than silently rewriting the meaning of past results - so a score is
      always interpretable, reproducible, and comparable to itself over time.
    </p>
  </div>

  <!-- current version card -->
  <section class="panel flex flex-col gap-4 border-l-2 border-l-accent p-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="label">Current methodology</p>
        <p class="font-mono text-3xl text-accent">{current.version}</p>
      </div>
      <p class="font-mono text-xs text-muted">since {current.released}</p>
    </div>
    <p class="text-sm leading-relaxed text-body">{current.summary}</p>

    <div>
      <p class="label mb-2">What this version pins</p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div class="panel p-3"><p class="label">Rating algorithm</p><p class="text-sm text-body">{current.constants.ratingAlgorithm}</p></div>
        <div class="panel p-3"><p class="label">Provisional until</p><p class="font-mono text-sm text-body">{current.constants.provisionalAttempts} attempts</p></div>
        <div class="panel p-3"><p class="label">High confidence at</p><p class="font-mono text-sm text-body">{current.constants.highConfidenceAttempts} attempts</p></div>
        <div class="panel p-3"><p class="label">Insights unlock at</p><p class="font-mono text-sm text-body">{current.constants.insightMinSessions} sessions</p></div>
        <div class="panel p-3"><p class="label">Public suppression floor</p><p class="font-mono text-sm text-body">{current.constants.populationMinCell}</p></div>
        <div class="panel p-3"><p class="label">Human-speed floor</p><p class="font-mono text-sm text-body">{current.constants.minHumanMs} ms</p></div>
      </div>
    </div>

    <div>
      <p class="label mb-2">In this version</p>
      <ul class="flex flex-col gap-1">
        {#each current.changes as ch}
          <li class="flex gap-2 text-sm text-muted"><span class="text-accent">·</span> {ch}</li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- registry / changelog: each version expandable to full detail -->
  <section class="flex flex-col gap-3">
    <p class="label">The formulas, versioned</p>
    <p class="text-sm leading-relaxed text-muted">
      These are the actual formulas of <span class="text-body">methodology m1</span> - not a
      description of them. Any change mints a new methodology version; every score is stamped
      with the version it was computed under, so nothing is ever silently redefined.
    </p>
    <div class="rounded border border-edge bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
      <p><span class="text-body">Speed class</span> (r = effective time / item's expected median):
        fast if r ≤ 0.7 · normal if r ≤ 1.6 · slow otherwise</p>
      <p class="pt-2"><span class="text-body">Attempt score</span> (correct answers only; wrong = 0):
        score = clamp(1.06 − 0.31·r, 0.45, 1.0) - a slow correct is never a zero</p>
      <p class="pt-2"><span class="text-body">Planning tasks</span>: speed ignored entirely; score = solution quality
        (1.0 at optimal, sliding toward a floor with inefficiency)</p>
      <p class="pt-2"><span class="text-body">Estimation (approximation) tasks</span>: normalized error
        e = |guess − true| / max(|true|, 1), so 0 = exact, 1 = off by the value itself.
        Score = the fraction of the population you beat on the SAME item (their errors larger
        than yours), once ≥ 5 others have answered it; before that, cold-start score = 1 / (1 + 4e)
        (exact → 1.0, 25% off → ≈0.5, ≥100% off → ≈0). One continuous error axis - no
        "close enough" tiers. "Correct" for accuracy displays means e ≤ 0.15.</p>
      <p class="pt-2"><span class="text-body">Fluency tasks</span>: score = min(1, valid distinct words / 12);
        validity per word is dictionary- or wordlist-checked with typo tolerance, and every
        word's verdict is shown to you.</p>
      <p class="pt-2"><span class="text-body">Reaction</span>: reported as a band, never a single number -
        the band narrows with trials so the uncertainty stays visible; hardware/network jitter
        credit is capped at 600 ms.</p>
      <p class="pt-2"><span class="text-body">Difficulty ladder</span>: +2 on fast correct · +1 on correct ·
        −1 on wrong · −2 on consecutive wrong (clamped to the level range)</p>
      <p class="pt-2"><span class="text-body">Stable level</span>: the highest level with ≥ 3 recent attempts
        at ≥ 65% accuracy</p>
      <p class="pt-2"><span class="text-body">Rating</span>: 700 + 52·stable + 380·(accuracy − 0.6) +
        260·(avgSpeedScore − 0.7), clamped to [600, 1900]</p>
      <p class="pt-2"><span class="text-body">Uncertainty (SEM)</span>: ± 400 / √(attempts + 3) rating points ·
        confidence: low &lt; 10 attempts · medium &lt; 30 · high ≥ 30</p>
      <p class="pt-2"><span class="text-body">Percentile</span>: your rank in the consented, registered pool;
        withheld below 20 pool-eligible rated users - and always shown WITH the pool size</p>
    </div>
    <p class="text-xs leading-relaxed text-muted">
      The repository is the canonical source of every constant above (AGPL) - what you read here
      is what runs.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What we measure at high resolution</p>
    <p class="text-sm leading-relaxed text-muted">
      Beyond answers and total time, attempts record task micro-measurements: time to first input
      (hesitation), edit counts while answering, per-word timestamps in fluency (for cluster and
      switch analysis), and the per-trial reaction series behind each band. These are measurements
      of the task, disclosed here because they exist: they feed your own statistics and insights.
      They are never used to identify anyone - timing precise enough to fingerprint a person is a
      capability we acknowledge and deliberately do not build, as a standing product decision.
    </p>
  </section>

  <section id="limitations" class="flex flex-col gap-3">
    <p class="label">Limitations - read before drawing conclusions</p>
      <p class="text-sm leading-relaxed text-muted">
        Context capture: sessions can optionally carry self-reported context - sleep hours,
        caffeine, mood, and a controlled vocabulary of tags (music, exercise, after work,
        illness and similar). All of it is skippable, private to the user, and used only for
        the user's own comparisons; it never enters cross-user statistics. Tags are a fixed,
        versioned vocabulary like the formulas - retired tags remain readable, and slugs are
        never reused with new meanings. One honest note: measuring context changes behavior
        slightly (people notice their coffee); we accept that and say it here.
      </p>
      <p class="text-sm leading-relaxed text-muted">
        The bank itself is audited in public: per-challenge difficulty and discrimination are
        published on the <a href="/statistics/items" class="text-accent hover:underline">item
        statistics</a> page, so weak items are visible to anyone, not just the maintainer.
      </p>
    <p class="text-sm leading-relaxed text-muted">
      Stated unprompted, because an instrument that hides its confounds is not one. The sample is
      <span class="text-body">self-selected</span> (volunteers who found a cognitive-training site),
      the setting <span class="text-body">unsupervised</span> (own device, own environment, any time
      of day - we record local hour and device class precisely so this can be modeled, not because
      it is controlled). Timing runs on consumer hardware over networks; we cap the network credit
      and floor human-plausible speed, which bounds but does not eliminate device variance.
      Percentiles describe <span class="text-body">this pool</span>, not the general population.
      Small groups are withheld (k ≥ floor), so published slices are truncated by design.
    </p>
    <p class="text-sm leading-relaxed text-muted">
      <span class="text-body">Ratings conflate ability with practice.</span> An Excogni Rating rises
      both when a faculty improves and when you learn the task format - a known property of every
      repeated cognitive measure, not a flaw we can silently remove. What we do instead: every
      attempt carries its ordinal position and first-exposure flag, so learning curves can be
      modeled explicitly and separated from trait estimates by anyone, including you. Test-retest
      reliability figures will be published from this same data once repeat-user volume permits.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">Version history</p>
    {#each data.registry as v}
      <details class="panel p-4" open={v.status === 'current'}>
        <summary class="flex cursor-pointer items-center justify-between">
          <span class="font-mono text-lg {v.status === 'current' ? 'text-accent' : 'text-muted'}">{v.version}</span>
          <span class="font-mono text-xs text-muted">since {v.released}{v.status === 'current' ? ' · current' : ' · superseded'}</span>
        </summary>
        <div class="mt-3 flex flex-col gap-3">
          <p class="text-sm text-muted">{v.summary}</p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div class="rounded border border-edge p-2"><p class="label">Algorithm</p><p class="text-xs text-body">{v.constants.ratingAlgorithm}</p></div>
            <div class="rounded border border-edge p-2"><p class="label">Provisional</p><p class="font-mono text-xs text-body">{v.constants.provisionalAttempts} att</p></div>
            <div class="rounded border border-edge p-2"><p class="label">High conf.</p><p class="font-mono text-xs text-body">{v.constants.highConfidenceAttempts} att</p></div>
            <div class="rounded border border-edge p-2"><p class="label">Insights</p><p class="font-mono text-xs text-body">{v.constants.insightMinSessions} sess</p></div>
            <div class="rounded border border-edge p-2"><p class="label">Floor</p><p class="font-mono text-xs text-body">{v.constants.populationMinCell}</p></div>
            <div class="rounded border border-edge p-2"><p class="label">Human-speed</p><p class="font-mono text-xs text-body">{v.constants.minHumanMs}ms</p></div>
          </div>
          <ul class="flex flex-col gap-1">
            {#each v.changes as ch}<li class="flex gap-2 text-xs text-muted"><span class="text-accent">·</span> {ch}</li>{/each}
          </ul>
        </div>
      </details>
    {/each}
  </section>

  <!-- live formulas: the exact computation, run by the real functions -->
  <section class="flex flex-col gap-4">
    <div>
      <p class="label">How the numbers are computed</p>
      <p class="text-xs text-muted">Worked examples below are produced by the actual scoring functions, not hand-written - radical transparency.</p>
    </div>

    <div class="panel flex flex-col gap-2 p-4">
      <p class="label">Effective response time (anti-spoof)</p>
      <p class="text-xs text-muted">The lower of client and server timing, floored, so a faked-fast client can't inflate a score.</p>
      <table class="mt-1 block w-full overflow-x-auto text-xs sm:table">
        <tbody>
          {#each data.formulas.timingExamples as t}
            <tr><td class="py-1 pr-4 text-muted">{t.label}</td><td class="py-1 pr-4 font-mono text-body">client {t.client ?? ' - '} / server {t.server}</td><td class="py-1 font-mono text-accent">→ {t.effective}ms</td></tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="panel flex flex-col gap-2 p-4">
      <p class="label">Score per attempt (speed × accuracy)</p>
      <p class="text-xs text-muted">Correct answers score on a curve by speed, with a floor so a slow-correct never scores zero.</p>
      <table class="mt-1 block w-full overflow-x-auto text-xs sm:table">
        <tbody>
          {#each data.formulas.scoreCurve as s}
            <tr><td class="py-1 pr-4 font-mono text-muted">{s.ms}ms ({s.speed})</td><td class="py-1 font-mono text-accent">score {s.score}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="panel flex flex-col gap-2 p-4">
      <p class="label">Confidence by sample size</p>
      <p class="text-xs text-muted">Standard error shrinks with attempts; a rating stays "provisional" until enough data.</p>
      <table class="mt-1 block w-full overflow-x-auto text-xs sm:table">
        <tbody>
          {#each data.formulas.semExamples as e}
            <tr><td class="py-1 pr-4 font-mono text-muted">{e.attempts} attempts</td><td class="py-1 pr-4 font-mono text-body">SEM {e.sem}</td><td class="py-1 font-mono text-accent">{e.confidence}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="panel flex flex-col gap-2 p-4">
      <p class="label">Operational constants ({data.formulas.constants.SCORING_MODEL_VERSION})</p>
      <div class="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
        <span class="text-muted">min human: <span class="text-body">{data.formulas.constants.MIN_HUMAN_MS}ms</span></span>
        <span class="text-muted">max scored: <span class="text-body">{data.formulas.constants.MAX_SCORED_MS}ms</span></span>
        <span class="text-muted">net credit: <span class="text-body">{data.formulas.constants.MAX_NETWORK_CREDIT_MS}ms</span></span>
        <span class="text-muted">min pool: <span class="text-body">{data.formulas.constants.MIN_POOL_FOR_PERCENTILE}</span></span>
        <span class="text-muted">rating range: <span class="text-body">{data.formulas.constants.RATING_MIN}-{data.formulas.constants.RATING_MAX}</span></span>
      </div>
    </div>
  </section>

  <!-- contribute -->
  <section class="panel flex flex-col gap-3 p-6">
    <p class="label">Contribute to the methodology</p>
    <p class="text-sm leading-relaxed text-muted">
      Excogni is meant to be a commons, not a black box. Researchers and practitioners can propose new
      paradigms and methods. Proposals enter as <span class="text-accent">experimental</span> - they
      collect data on real users but do not affect official scores - and only graduate into the
      canonical battery after review for reliability, discrimination, and construct validity. Each
      change is recorded here with its version.
    </p>
    <a href="/contribute" class="btn-primary self-start text-sm">Contribute methodologically</a>
  </section>
</div>
