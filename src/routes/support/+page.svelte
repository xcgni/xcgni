<script lang="ts">
  // Support page. Donations-only by design until a legal entity exists: individual rails
  // (GitHub Sponsors, Liberapay) that require no company. No perks, no gated features, no
  // sales - the entity-status paragraph below states this plainly.
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
      the tools are <span class="text-body">free and open to everyone</span> - and the
      project is funded by people who choose to support it. When you contribute, you aren't
      buying something the rest are denied. You're keeping a commons open for everyone,
      including people who pay nothing. That's the whole idea: positive-sum, not pay-to-win.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What's always free - for everyone, forever</p>
    <ul class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
      <li>- <span class="text-body">The full instrument.</span> Every category, every challenge, honest measurement. No paywall on the cause.</li>
      <li>- <span class="text-body"><a href="/statistics" class="hover:text-accent hover:underline">Global statistics &amp; tools.</a></span> The aggregate picture is a public good, open to all.</li>
      <li>- <span class="text-body">Full transparency.</span> Exactly how every number is computed is <a href="/formulas" class="text-accent hover:underline">published openly</a>.</li>
      <li>- <span class="text-body">Your data, your control.</span> Export or delete everything, anytime.</li>
    </ul>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">How your data works</p>
    <p class="text-sm leading-relaxed text-muted">
      Practising anonymously keeps your results entirely your own. Anything that feeds the
      shared statistics is <span class="text-body">anonymised and never tied to your
      identity</span> - aggregates only, with small groups withheld so no individual can be
      singled out. Supporting the project changes none of this: members get
      <span class="text-body">recognition and a voice, never special access to your own or
      anyone else's data</span>. There is no tier that unlocks the science, because the
      science is already open.
    </p>
  </section>

  <section class="flex flex-col gap-4">
    <p class="label">Ways to support</p>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="panel flex flex-col gap-3 p-5">
        <p class="text-body">GitHub Sponsors</p>
        <p class="text-sm text-muted">One-off or monthly, through GitHub. Zero platform fees, so the whole contribution reaches the project.</p>
        <a class="btn-primary mt-auto text-center" href="https://github.com/sponsors/initsixdev" target="_blank" rel="noopener">Sponsor on GitHub</a>
      </div>
      <div class="panel flex flex-col gap-3 p-5">
        <p class="text-body">Liberapay</p>
        <p class="text-sm text-muted">Recurrent donations without a GitHub account. Built for supporting open work, nothing owed in return.</p>
        <a class="btn mt-auto text-center" href="https://liberapay.com/initsixdev" target="_blank" rel="noopener">Give on Liberapay</a>
      </div>
    </div>
    <p class="text-xs text-muted">
      Plainly, so nothing is oversold: contributions are personal donations that keep the servers
      on and the work going - they buy nothing, unlock nothing, and are not purchases. Excogni is
      currently the personal project of one person, not a company; if support grows into something
      that sustains real costs, it becomes a proper entity, and that step will be announced in the
      public changelog like everything else. Sharing the project or starring the repository is
      support too, and costs nothing.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">Why this way</p>
    <p class="text-sm leading-relaxed text-muted">
      Most apps create value by withholding it - paywalls, dark patterns, selling attention
      or data. We'd rather the opposite: the truth is free, the data is anonymous and open
      in aggregate, and the people who can, chip in so that stays true for everyone who
      can't. No ads. No selling your data. No manufactured pressure to keep you here. If the
      project ever takes institutional or research funding, it will be to keep the commons
      free - never to gate it.
    </p>
  </section>

  <div class="flex gap-3 pt-2">
    <a href="/practice" class="btn-primary">Start practising</a>
    <a href="/formulas" class="btn">See how it works</a>
  </div>
</div>
