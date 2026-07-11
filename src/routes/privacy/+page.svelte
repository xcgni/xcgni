<script lang="ts">
  import { t, locale } from '$lib/i18n/store';
  export let data;
</script>

<svelte:head><title>Privacy - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-8 py-10">
  <h1 class="h-page">Privacy</h1>
  {#if $locale !== 'en'}<p class="mt-2 text-xs text-muted">{$t('page.enOnly')}</p>{/if}
  <p class="text-sm leading-relaxed text-muted">
    The short version: you are the person being measured, not the product being sold. Everything
    below follows from that.
  </p>

  <section class="flex flex-col gap-3">
    <p class="label">What we collect</p>
    <p class="text-sm leading-relaxed text-muted">
      <span class="text-body">Account:</span> an email is asked for only if you register (you
      can practise anonymously){#if data.emailShield} - and even then the readable address is
      never stored (see <a href="#email" class="text-accent hover:underline">below</a>){/if},
      plus a generated username (like quiet-falcon-42) - generated precisely so no surface ever
      has to show your email as identity. <span class="text-body">About you:</span> optional self-reported
      attributes (age band, country, education, native language, handedness) - every field can be
      left blank. <span class="text-body">Performance:</span> your answers, scores, ratings and
      timing on challenges, including high-resolution task measurements (time to first input,
      edit counts, per-word timing in fluency, per-trial reaction series). These are measurements
      of the task, not surveillance of you: they power your own statistics and insights.
      <span class="text-body">Session context:</span> the optional pre-session questionnaire and
      tags (sleep, mood, coffee, and so on) - private to you, used only to compare your own days,
      never shared and never aggregated across users.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What it's used for</p>
    <p class="text-sm leading-relaxed text-muted">
      Your data powers your own stats, insights and progress. If (and only if) you tick the
      research consent, your performance data also joins anonymous, aggregate population
      statistics - percentiles, distributions - from which no individual can be identified.
      Anonymous practice never joins the pool: contribution requires a registered account, and
      that email requirement exists to make fake and duplicate data harder, not to identify you.
      Withdrawing is a checkbox.
    </p>
  </section>

  <section id="email" class="flex flex-col gap-3">
    <p class="label">Your email: we don't have it</p>
    {#if data.emailShield}
      <p class="text-sm leading-relaxed text-muted">
        When you register, the address you type is used in that moment to send you the login
        link - and is then discarded. What the database keeps is a one-way code computed from
        it with a secret key that never touches the database. At your next login you type the
        address again, the same code is computed, and it matches. So: we know how to log you
        in, but no readable email exists anywhere in our data - not in the users table, not on
        the login links, not in your own data export. A breach of the database would leak zero
        email addresses.
      </p>
      <p class="text-sm leading-relaxed text-muted">
        Being plain about the limits, because that's the house style: your practice history
        does belong to one account, so your results are connected to each other - just not to
        a readable you. And because we can't read your address, we also can't email you
        unprompted: no newsletters, no "we miss you" - and if something ever goes wrong, the
        notice happens here and in the app, not in your inbox. We think that trade is worth it.
      </p>
    {:else}
      <p class="text-sm leading-relaxed text-muted">
        Your email is used to send login links and to make duplicate or fake accounts harder -
        never shown as identity, never shared, never used for marketing. (This self-hosted
        instance stores it in the standard way; the upstream project supports a keyed one-way
        index that avoids storing the readable address at all.)
      </p>
    {/if}
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">What we don't do</p>
    <p class="text-sm leading-relaxed text-muted">
      No ads. No selling or sharing data with third parties. No trackers - the only cookie is
      your session. No engagement tricks built on your data. We do not use timing data to
      identify people, and we never will as a product decision; the methodology page says so in
      writing.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">Deletion and export</p>
    <p class="text-sm leading-relaxed text-muted">
      You can export everything about your account from Settings, and delete your account
      in-app: deletion removes your data with a verified cascade (we test it with a script,
      not a promise). Anonymous accounts expire with their cookie.
    </p>
  </section>

  <section class="flex flex-col gap-3">
    <p class="label">Contact</p>
    <p class="text-sm leading-relaxed text-muted">
      Questions or requests: <a class="text-accent hover:underline" href="mailto:security@initsix.dev">security@initsix.dev</a>.
      This page changes only with a note in the public changelog.
    </p>
  </section>
</div>
