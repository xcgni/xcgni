<script lang="ts">
  // Support page. Payment rails are intentionally OFF for launch: no GitHub Sponsors,
  // no Liberapay, no legal entity yet. The only support asked for now is the kind that
  // costs nothing (share, star, report holes). Paid rails return once an entity exists,
  // announced in the public changelog.
</script>

<svelte:head><title>Support Excogni</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 py-8 sm:gap-8 sm:py-10">
  <div class="flex flex-col gap-2">
    <p class="label text-accent">Support</p>
    <h1 class="h-page">The mission is free. You support it because you believe in it.</h1>
  </div>

  <section class="flex flex-col gap-3">
    <p class="leading-relaxed">
      Excogni is built on a simple model: the honest instrument, the global statistics, and
      the tools are <span class="text-body">free and open to everyone</span>. When you help,
      you aren't buying something the rest are denied. You're keeping a commons open for
      everyone, including people who give nothing. That's the whole idea: positive-sum, not
      pay-to-win.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What's always free - for everyone, forever</p>
    <ul class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
      <li>- <span class="text-body">The full instrument.</span> Every category, every challenge, honest measurement. No paywall on the cause.</li>
      <li>- <span class="text-body"><a href="/statistics" class="hover:text-accent hover:underline">Global statistics &amp; tools.</a></span> The aggregate picture is a public good, open to all.</li>
      <li>- <span class="text-body">Full transparency.</span> Exactly how every number is computed is <a href="/methodology" class="text-accent hover:underline">published openly</a>.</li>
      <li>- <span class="text-body">Your data, your control.</span> Export or delete everything, anytime.</li>
    </ul>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">How to help right now</p>
    <p class="text-sm leading-relaxed text-muted">
      Financial support isn't set up yet, and honestly the most useful help at this stage costs
      nothing. The single biggest one: <span class="text-body">register and tick the research
      consent</span>, so your results count toward the shared statistics. Percentiles only mean
      something with a population behind them, and that population is the whole point.
    </p>
    <ul class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
      <li>- <span class="text-body">Use it, and feed the commons.</span> An account (an email, nothing more) is what turns your practice into a data point everyone benefits from.</li>
      <li>- <span class="text-body"><a href="https://github.com/xcgni/xcgni" class="text-accent hover:underline" target="_blank" rel="noopener">Star or fork the repository.</a></span> It's open source (AGPL); visibility and contributors are worth more than money right now.</li>
      <li>- <span class="text-body">Report holes.</span> Found a bug, a bad challenge, or a scoring quirk? The in-app feedback button goes straight to the maintainer.</li>
      <li>- <span class="text-body">Tell someone.</span> Sharing the project with a person who'd find it useful is real support, and costs nothing.</li>
    </ul>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">The money part, later and honest</p>
    <p class="text-sm leading-relaxed text-muted">
      There is no way to pay for anything here, and nothing is being collected. Excogni is
      currently the personal project of one person, not a company. If it grows into something
      with real running costs, two things may follow: a way to donate, and a symbolic price on
      the mobile apps for conveniences like reminders - never on anything measured. Both would
      require a proper legal entity first, and that step would be announced in the
      <a href="/changelog" class="text-accent hover:underline">public changelog</a> like
      everything else. No ads, no selling of individuals' data, ever.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">Why this way</p>
    <p class="text-sm leading-relaxed text-muted">
      Most apps create value by withholding it - paywalls, dark patterns, selling attention or
      data. We'd rather the opposite: the truth is free, the data is anonymous and open in
      aggregate, and one day the people who can will chip in so that stays true for everyone who
      can't. No ads. No selling your data. No manufactured pressure to keep you here.
    </p>
  </section>

  <div class="flex gap-3 pt-2">
    <a href="/practice" class="btn-primary">Start practising</a>
    <a href="/methodology" class="btn">See how it works</a>
  </div>
</div>
