<script lang="ts">
  export let data;
</script>

<svelte:head><title>What Excogni is - and isn't</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 py-8 sm:gap-8 sm:py-10">
  <div class="flex flex-col gap-2">
    <p class="label text-accent">About</p>
    <h1 class="h-page">What Excogni is - and what it isn't</h1>
  </div>

  <section class="flex flex-col gap-3">
    <p class="leading-relaxed">
      Excogni is a place to exercise your thinking - a set of short, adaptive
      challenges across memory, reasoning, attention, speed, and more. Every
      challenge trains you and, at the same time, takes a quiet measurement of how
      you're doing, so you can watch your own progress over time.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What it is</p>
    <ul class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
      <li>- A training tool that adapts to your level and shows honest progress.</li>
      <li>- A personal instrument: your numbers are yours, private by default.</li>
      <li>- An early, evolving project. Your use helps it get better and more accurate.</li>
    </ul>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What we stand for</p>
    <p class="text-sm leading-relaxed text-muted">
      Excogni aims at three things. <span class="text-body">Staying sharp:</span> practice that
      adapts to you and genuinely trains. <span class="text-body">Insight:</span> not just scores,
      but understanding - when you do well, what helps you, and what the numbers can and cannot
      say. <span class="text-body">Self-knowledge:</span> over months, a truthful picture of your
      own mind that you could not get any other way.
    </p>
    <p class="text-sm leading-relaxed text-muted">
      And one way of working: <span class="text-body">respect</span>. You are the person being
      measured, not the product being sold. That means transparent methods (every formula is
      public), honest numbers (uncertainty shown; if a measurement can't be made honestly, we say
      so instead of inventing a figure), no dark patterns (no streak guilt, no nagging, no
      engagement tricks), and your data treated as yours - detailed below.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What it isn't</p>
    <ul class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
      <li>- <span class="text-body">Not an IQ test.</span> It does not produce an IQ or any clinical score, and makes no claim to.</li>
      <li>- <span class="text-body">Not a diagnosis.</span> It can't tell you anything about a medical or psychological condition.</li>
      <li>- <span class="text-body">Not yet scientifically validated.</span> The ratings are designed to be consistent and honest, but we have not yet proven they measure cognitive ability in the way a formal, validated test would. We're gathering data to study exactly that - and we'll be upfront about what we find.</li>
    </ul>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">How we treat your data</p>
    <p class="text-sm leading-relaxed text-muted">
      Practising anonymously keeps your results entirely to yourself and out of any
      shared statistics. Anything optional you share (like your age range or
      language) is used only for anonymous, aggregate research and is never tied to
      your identity or shown to anyone - small groups are withheld so no individual can
      be singled out. You can export everything or delete your account at any time from
      Settings. No ads, ever. We never sell your data.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">Free, open, and supported - not sold</p>
    <p class="text-sm leading-relaxed text-muted">
      The instrument, the <a href="/statistics" class="text-accent hover:underline">global statistics</a>, and the tools are free and open to everyone.
      The aggregate picture is a public good; how every number is computed is
      <a href="/methodology" class="text-accent hover:underline">published openly</a>. The
      project is funded by people who choose to support it, not by ads, paywalls on the
      cause, or selling your data - when someone contributes, they keep the commons open
      for everyone, including those who pay nothing. <a href="/support" class="text-accent hover:underline">How support works →</a>
    </p>
    <p class="text-sm leading-relaxed text-muted">
      Excogni is built and maintained by <a href="https://initsix.dev" class="text-accent hover:underline" rel="noopener" target="_blank">initsix.dev</a> and is <a href="https://github.com/xcgni/xcgni" class="text-accent hover:underline" rel="noopener" target="_blank">open source (AGPL)</a>.
      The people who tested, questioned, and refined it are on the
      <a href="/contributions" class="text-accent hover:underline">contributions page</a>.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">The faculties</p>
    <p class="text-sm leading-relaxed text-muted">
      Each category has its own plain-language explainer - what it measures, why it matters,
      and how the challenges work.
    </p>
    <ul class="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {#each data.faculties as f (f.slug)}
        <li>
          <a href={`/about/${f.slug}`} class="text-sm text-accent hover:underline">{f.name}</a>
        </li>
      {/each}
    </ul>
  </section>

  <div class="flex gap-3 pt-2">
    <a href="/practice" class="btn-primary">Start practicing</a>
    <a href="/stats" class="btn">Dashboard</a>
    <a href="/methodology" class="btn">Methodology &amp; formulas</a>
  </div>
</div>
