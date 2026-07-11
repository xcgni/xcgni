<script lang="ts">
  import { t } from '$lib/i18n/store';
  // Landing. The hero is the product thesis; the primary action drops the
  // visitor straight into anonymous mixed practice with zero friction.
  export let data;
</script>

<svelte:head><title>Excogni - keep your mind sharp</title></svelte:head>

<section class="flex flex-col items-start gap-8 py-10 sm:py-20">
  <p class="label">Cognitive fitness · measured</p>
  <h1 class="max-w-2xl text-4xl font-light leading-tight sm:text-5xl">
    The tools think for you all day.<br />
    <span class="text-accent">This is where you still think for yourself.</span>
  </h1>
  <p class="max-w-xl text-muted">
    Excogni is a gym for the mind. Adaptive challenges train and measure at the same time -
    no visible timers, no gimmicks. You get an honest, calibrated rating and a clean
    way to see whether you are getting sharper over time.
  </p>
  <div class="flex flex-wrap items-center gap-4">
    <a href="/welcome" class="btn-primary">{$t('landing.start')}</a>
    <a href="/auth/login" class="btn">{$t('landing.login')}</a>
    <a href="/about" class="text-sm text-muted hover:text-body">{$t('landing.learnMore')}</a>
  <p class="mt-3 text-xs text-muted measure prose-quiet">{$t('landing.equalAnon')} <a href="/privacy#equal" class="underline hover:text-body">{$t('w.howWeProtect')}</a></p>
  </div>
  <p class="text-sm text-muted">
    No account needed to start. Anonymous practice stays entirely yours - private by default,
    and it never joins the population statistics. Registering (an email, nothing more) is what
    makes your results count toward the pool; the email exists to make fake data harder, not to
    identify you.
    {#if data.emailShield}
      <span class="block pt-2 text-body">We can't leak your email. We don't have it.
        <a href="/privacy#email" class="text-accent hover:underline">Learn how →</a></span>
    {/if}
  </p>
</section>

<section class="grid grid-cols-1 gap-px border border-edge bg-edge sm:grid-cols-3">
  <div class="bg-ink p-6">
    <p class="label mb-3">Train = measure</p>
    <p class="text-sm text-muted">Every challenge is both an exercise and a measurement sample. No separate exams.</p>
  </div>
  <div class="bg-ink p-6">
    <p class="label mb-3">Adaptive level</p>
    <p class="text-sm text-muted">Difficulty follows your performance. Slow and correct is valid - the system simply learns your level.</p>
  </div>
  <div class="bg-ink p-6">
    <p class="label mb-3">Calibrated rating</p>
    <p class="text-sm text-muted">A norm-referenced rating and percentile, built from a deterministic, reviewed challenge bank.</p>
  </div>
</section>

<section class="flex flex-col gap-6 py-10">
  <div class="flex flex-col gap-1">
    <p class="label">What you get</p>
    <h2 class="text-2xl font-light">Four things, plainly.</h2>
  </div>
  <div class="grid grid-cols-1 gap-px border border-edge bg-edge sm:grid-cols-2">
    <div class="bg-ink p-6">
      <p class="mb-2 font-mono text-sm text-accent">01 · Measure</p>
      <p class="text-sm text-body">See your cognitive abilities across memory, attention, reasoning, processing speed and more - each measured, not guessed.</p>
    </div>
    <div class="bg-ink p-6">
      <p class="mb-2 font-mono text-sm text-accent">02 · Improve</p>
      <p class="text-sm text-body">Practise to keep and sharpen them. Your rating tracks whether you're actually getting better over time, honestly.</p>
    </div>
    <div class="bg-ink p-6">
      <p class="mb-2 font-mono text-sm text-accent">03 · Compare to others</p>
      <p class="text-sm text-body">A percentile against the wider population, so you know where you stand - not just a number in isolation.</p>
    </div>
    <div class="bg-ink p-6">
      <p class="mb-2 font-mono text-sm text-accent">04 · Compare to yourself</p>
      <p class="text-sm text-body">Your own trend line, best and toughest days, and the conditions behind them. The most useful benchmark is your past self.</p>
    </div>
  </div>
  <p class="max-w-xl text-sm text-muted">
    A first read on every ability comes within a few focused sessions. Deeper patterns - your best times of day, what helps and what doesn't - build as you keep going.
  </p>
</section>
