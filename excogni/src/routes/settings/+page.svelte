<script lang="ts">
  import { t } from '$lib/i18n/store';
  import { isNative } from '$lib/native';
  import { onMount } from 'svelte';
  let inApp = false;
  onMount(async () => { inApp = await isNative(); });
  import { COUNTRIES, LANGUAGES, AGE_BANDS, EDUCATION, HANDEDNESS } from '$lib/demographics';
  export let data;
  export let form;
  let confirming = false;
  let sessionLen = data.prefs?.sessionLength ?? 10;
</script>

<svelte:head><title>Settings - Excogni</title></svelte:head>

<div class="flex max-w-2xl flex-col gap-8">
  <p class="label">Settings</p>

  <section class="panel flex flex-col gap-4 p-5">
    <div class="flex flex-col gap-1">
      <p class="label">Appearance</p>
      <p class="text-sm text-muted">Pick the look that suits you. All themes keep the same calm, focused instrument feel - just different colour.</p>
    </div>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {#each [['serious','Amber','#E2A33B'],['warm','Warm','#4FB6C9'],['slate','Slate','#6FB6D6'],['phosphor','Phosphor','#76D68D'],['ion','Ion','#60A8FF']] as [key, label, swatch]}
        <a
          href="/settings?variant={key}"
          data-sveltekit-reload
          class="flex flex-col items-center gap-2 rounded border p-3 transition-colors {data.variant === key ? 'border-accent' : 'border-edge hover:border-muted'}"
        >
          <span class="h-6 w-6 rounded-full border border-edge" style="background:{swatch}"></span>
          <span class="text-xs {data.variant === key ? 'text-accent' : 'text-muted'}">{label}</span>
        </a>
      {/each}
    </div>
  </section>

  {#if data.user}
    <section class="panel flex flex-col gap-4 p-5">
      <p class="label">Practice</p>
      <p class="text-sm text-muted">Set how long a mixed session runs. Manage which categories are in the mix on the practice page.</p>
      <form method="POST" action="?/savePractice" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          <span class="label">Session length: <span class="font-mono text-body">{sessionLen}</span> questions</span>
          <input type="range" name="session_length" min="3" max="50" bind:value={sessionLen} class="accent-[rgb(var(--c-accent))]" />
        </label>
        <div class="flex items-center gap-4">
          <button type="submit" class="btn self-start">Save practice settings</button>
          {#if form?.prefSaved}<span class="text-sm text-ok">Saved</span>{/if}
        </div>
      </form>
      <div class="flex flex-col gap-1 border-t border-edge pt-3">
        <span class="label">Categories in the mix</span>
        <p class="text-sm text-muted">All categories are on by default. Toggle any in or out on the practice page.</p>
        <a href="/practice" class="btn self-start">Manage categories</a>
      </div>
    </section>

  <!-- App reminders: local notifications scheduled by the native shell. Shown ONLY inside the
       app: a browser can't fire these, and a toggle that can't act is a broken promise. -->
  {#if inApp}
  <section class="panel flex flex-col gap-4 p-5">
    <p class="label">App reminders</p>
    <form method="POST" action="?/saveReminders" class="flex flex-col gap-4">
      <label class="flex items-center justify-between gap-4">
        <span class="text-sm">Daily practice reminder <span class="text-muted">(a quiet local notification)</span></span>
        <input type="checkbox" name="reminder_enabled" checked={data.reminders?.enabled} class="h-5 w-5 accent-[rgb(var(--c-accent))]" />
      </label>
      <label class="flex items-center justify-between gap-4">
        <span class="text-sm">Reminder time</span>
        <input type="time" name="reminder_time" value={data.reminders?.time ?? '18:00'} class="field max-w-[140px]" />
      </label>
      <label class="flex items-center justify-between gap-4">
        <span class="text-sm">Heads-up when cards come due <span class="text-muted">(at most one per day)</span></span>
        <input type="checkbox" name="conditional_enabled" checked={data.reminders?.conditional} class="h-5 w-5 accent-[rgb(var(--c-accent))]" />
      </label>
      <div class="flex items-center gap-3">
        <button class="btn-primary" type="submit">Save reminders</button>
        {#if form?.remindersSaved}<span class="text-sm text-ok">Saved.</span>{/if}
      </div>
      <p class="text-xs text-muted">Reminders are quiet facts ("6 cards are due"), never pressure. Everything here is off unless you turn it on.</p>
    </form>
  </section>
  {/if}

  <!-- Preferred retention decks: what the spaced-repetition module serves by default (incl. in-mix). -->
  <section class="panel flex flex-col gap-4 p-5">
    <p class="label">Retention decks</p>
    <form method="POST" action="?/saveDecks" class="flex flex-col gap-3">
      <p class="text-sm text-muted">What would you like to memorize? Pick any; none selected means all decks.</p>
      <div class="flex flex-wrap gap-1.5">
        {#each data.retentionDecks ?? [] as d}
          <label class="cursor-pointer">
            <input type="checkbox" name="preferred_decks" value={d.slug} checked={data.preferredDecks?.includes(d.slug)} class="peer sr-only" />
            <span class="inline-block rounded border border-edge px-2.5 py-1 text-xs text-muted peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent">{d.label}</span>
          </label>
        {/each}
      </div>
      <div class="flex items-center gap-3">
        <button class="btn-primary" type="submit">Save decks</button>
        {#if form?.decksSaved}<span class="text-sm text-ok">Saved.</span>{/if}
      </div>
    </form>
  </section>

  {#if data.reducedCategories?.length}
    <section class="panel flex flex-col gap-3 p-5">
      <p class="label">Showing less often</p>
      <p class="text-sm text-muted">These categories appear at reduced frequency in the mix (about a third of normal). Restore any of them to full rotation:</p>
      <div class="flex flex-wrap gap-2">
        {#each data.reducedCategories as slug}
          <form method="POST" action="?/restoreReduced">
            <input type="hidden" name="slug" value={slug} />
            <button class="rounded border border-edge px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-body" type="submit">{slug.replace(/-/g, ' ')} · restore</button>
          </form>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Opt-in embeddable badge: makes rating+percentile publicly reachable by URL - user's choice. -->
  {#if data.user && !data.user.isAnonymous}
    <section id="public-badge" class="panel flex flex-col gap-4 p-5">
      <p class="label">Public badge</p>
      <form method="POST" action="?/saveBadge" class="flex flex-col gap-3">
        <label class="flex items-center justify-between gap-4">
          <span class="text-sm">Embeddable badge <span class="text-muted">(shows your global rating and percentile at a public URL - off by default)</span></span>
          <input type="checkbox" name="public_badge" checked={data.publicBadge} class="h-5 w-5 accent-[rgb(var(--c-accent))]" />
        </label>
        <div class="flex items-center gap-3">
          <button class="btn-primary" type="submit">Save badge setting</button>
          {#if form?.badgeSaved}<span class="text-sm text-ok">Saved.</span>{/if}
        </div>
        {#if data.publicBadge && data.user.username}
          <p class="text-xs text-muted">Embed it anywhere:</p>
          <code class="block break-all rounded border border-edge bg-ink p-2 font-mono text-xs text-muted">&lt;img src="https://xcgni.com/badge/{data.user.username}.svg" alt="Excogni rating" /&gt;</code>
        {/if}
      </form>
    </section>
  {/if}
  {/if}

  <section class="panel flex flex-col gap-3 p-5">
    <p class="label">Account</p>
    {#if data.user && !data.user.isAnonymous}
      <p class="text-sm">
        Signed in as <span class="font-mono text-accent">{data.user.username ?? data.user.emailHint}</span>{#if data.user.username && data.user.emailHint}<span class="block pt-1 text-xs text-muted">login email: <span class="font-mono">{data.user.emailHint}</span> · shown masked because the readable address is never stored - only a keyed one-way index for login</span>{/if}
      </p>
      <a href="/auth/logout" class="btn self-start">Log out</a>
    {:else if data.user}
      <p class="text-sm text-muted">
        You are practicing anonymously. Register with a magic link to keep your history across devices.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <a href="/auth/login" class="btn self-start">Register / log in</a>
        <form method="POST" action="?/resetAnonymous">
          <button type="submit" class="label text-muted hover:text-body">Reset for a new person →</button>
        </form>
      </div>
      <p class="text-xs text-muted">Reset starts a fresh anonymous account - handy for letting someone else try on this device. Your current anonymous history is unlinked from this browser (registering first keeps it).</p>
      {#if form?.resetError}<p class="text-xs text-bad">{form.resetError}</p>{/if}
    {:else}
      <p class="text-sm text-muted">No active session.</p>
      <a href="/auth/login" class="btn self-start">Log in</a>
    {/if}
  </section>

  <section class="panel flex flex-col gap-3 p-5">
    <p class="label">Your data</p>
    <p class="text-sm text-muted">
      Download everything Excogni holds about you - account, settings, every attempt, and your full
      rating history - as a single JSON file. The "your data is yours" promise, made concrete.
    </p>
    <a href="/api/export" class="btn self-start" download>Download my data (JSON)</a>
  </section>

  <section class="panel flex flex-col gap-3 p-5">
    <p class="label">Privacy</p>
    <p class="text-sm text-muted">
      Excogni is private by default. Your ratings and history are visible only to you.
      There are no leaderboards, no public profiles, and no sharing unless a future
      version adds it as an explicit opt-in. Anonymous practice never enters the
      population pool that percentiles are computed from.
    </p>
  </section>

  {#if data.user}
    <section class="panel flex flex-col gap-4 p-5">
      <p class="label">{$t('wd.aboutYou')} (optional)</p>
      <p class="text-sm text-muted">
        These details only produce anonymous, aggregate statistics - trends across groups. They're
        <span class="text-body">never</span> tied to your identity, shown to others, or used to identify
        you. Every field is optional; change, clear, export, or delete them anytime.
      </p>

      <form method="POST" action="?/saveAttributes" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1">
            <span class="label">Age</span>
            <select name="age_band" class="field">
              <option value="" selected={!data.attributes?.age_band}>-</option>
              {#each AGE_BANDS as b}<option value={b} selected={data.attributes?.age_band === b}>{b}</option>{/each}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">Country / region</span>
            <select name="country" class="field">
              <option value="" selected={!data.attributes?.country}>-</option>
              {#each COUNTRIES as c}<option value={c} selected={data.attributes?.country === c}>{c}</option>{/each}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">City <span class="text-muted/60">(optional)</span></span>
            <input name="city" type="text" class="field" placeholder="e.g. Zagreb" autocomplete="off" value={data.attributes?.city ?? ''} />
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">Gender</span>
            <select name="gender" class="field">
              <option value="" selected={!data.attributes?.gender}>-</option>
              <option value="female" selected={data.attributes?.gender === 'female'}>Female</option>
              <option value="male" selected={data.attributes?.gender === 'male'}>Male</option>
              <option value="other" selected={data.attributes?.gender === 'other'}>Other</option>
              <option value="prefer_not" selected={data.attributes?.gender === 'prefer_not'}>{$t('wd.prefNot')}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">{$t('wd.education')}</span>
            <select name="education" class="field">
              <option value="" selected={!data.attributes?.education}>-</option>
              <option value="secondary" selected={data.attributes?.education === 'secondary'}>Secondary</option>
              <option value="vocational" selected={data.attributes?.education === 'vocational'}>Vocational</option>
              <option value="bachelor" selected={data.attributes?.education === 'bachelor'}>Bachelor's</option>
              <option value="master" selected={data.attributes?.education === 'master'}>Master's</option>
              <option value="doctorate" selected={data.attributes?.education === 'doctorate'}>Doctorate</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">{$t('wd.native')}</span>
            <select name="native_language" class="field">
              <option value="" selected={!data.attributes?.native_language}>-</option>
              {#each LANGUAGES as l}<option value={l} selected={data.attributes?.native_language === l}>{l}</option>{/each}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">{$t('wd.handed')}</span>
            <select name="handedness" class="field">
              <option value="" selected={!data.attributes?.handedness}>-</option>
              <option value="right" selected={data.attributes?.handedness === 'right'}>Right</option>
              <option value="left" selected={data.attributes?.handedness === 'left'}>Left</option>
              <option value="ambi" selected={data.attributes?.handedness === 'ambi'}>Ambidextrous</option>
            </select>
          </label>
        </div>

        <div class="rounded border border-edge p-3">
          <p class="label mb-2">For research: an external test score (optional)</p>
          <p class="mb-3 text-xs text-muted">
            If you've taken a formal cognitive or aptitude test, sharing the type and score lets us
            check whether Excogni's ratings actually track an outside reference - the difference
            between "consistent" and "valid". Entirely optional and aggregate-only.
          </p>
          <div class="grid grid-cols-2 gap-4">
            <label class="flex flex-col gap-1">
              <span class="label">Test type</span>
              <select name="ext_test_type" class="field">
                <option value="" selected={!data.attributes?.ext_test_type}>-</option>
                <option value="iq" selected={data.attributes?.ext_test_type === 'iq'}>IQ test</option>
                <option value="sat" selected={data.attributes?.ext_test_type === 'sat'}>SAT</option>
                <option value="gre" selected={data.attributes?.ext_test_type === 'gre'}>GRE</option>
                <option value="other" selected={data.attributes?.ext_test_type === 'other'}>Other</option>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="label">Score</span>
              <input name="ext_test_score" type="number" placeholder="optional"
                value={data.attributes?.ext_test_score ?? ''} class="field" />
            </label>
          </div>
        </div>

        <label class="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="consented_stats" class="mt-0.5 h-4 w-4 accent-[rgb(var(--c-accent))]"
            checked={data.attributes?.consented_stats ?? false} />
          I consent to my anonymised results being used for aggregate statistics and research, as above.
        </label>

        <div class="flex items-center gap-4">
          <button type="submit" class="btn self-start">Save details</button>
          {#if form?.attrSaved}<span class="text-sm text-ok">Saved</span>{/if}
          {#if form?.attrError}<span class="text-sm text-bad">{form.attrError}</span>{/if}
        </div>
      </form>
    </section>
  {/if}

  {#if data.user}
    <section class="panel flex flex-col gap-3 border-bad/40 p-5">
      <p class="label text-bad">Delete account</p>
      <p class="text-sm text-muted">
        Deleting your account removes everything that is yours or points to you: your personal
        data, and the link between you and every attempt, session, rating and setting - the
        cascade is verified, not promised. What cannot be taken back is what was never yours
        alone: contributions already blended into the anonymous population statistics stay in
        the aggregates, exactly because nothing in them can ever lead back to you. Immediate,
        and cannot be undone.
      </p>
      {#if !confirming}
        <button class="btn self-start hover:border-bad hover:text-bad" on:click={() => (confirming = true)}>
          Delete my account…
        </button>
      {:else}
        <form method="POST" action="?/deleteAccount" class="flex items-center gap-3">
          <button type="submit" class="btn border-bad text-bad hover:bg-bad/10">Yes, delete everything</button>
          <button type="button" class="btn" on:click={() => (confirming = false)}>Cancel</button>
        </form>
      {/if}
    </section>
  {/if}
</div>
