<script lang="ts">
  import { t } from '$lib/i18n/store';
  export let data;
  const s = data.session;
  const fmtMs = (ms: number | null) => (ms == null ? '-' : (ms / 1000).toFixed(1) + 's');
  const fmtDelta = (d: number | null) => (d == null ? '-' : (d > 0 ? '+' : '') + d);

  // Plain-language "what changed this session" - transparency, not just numbers.
  function narrative(sess: typeof s): string {
    if (!sess) return '';
    const parts: string[] = [];
    if (sess.ratingDelta != null && sess.ratingDelta > 0) {
      parts.push(`Your rating rose ${sess.ratingDelta} point${sess.ratingDelta === 1 ? '' : 's'}`);
    } else if (sess.ratingDelta != null && sess.ratingDelta < 0) {
      parts.push(`Your rating eased ${Math.abs(sess.ratingDelta)} point${sess.ratingDelta === -1 ? '' : 's'} as the system found your level`);
    } else {
      parts.push('Your rating held steady');
    }
    if (sess.accuracy != null) {
      if (sess.accuracy >= 80) parts.push('accuracy was strong');
      else if (sess.accuracy < 55) parts.push('this was a tough set');
    }
    return parts.join(', ') + '.';
  }

  // An actionable next-step, derived from how the session actually went.
  function nextStep(sess: typeof s): string | null {
    if (!sess) return null;
    if (sess.accuracy != null && sess.accuracy < 55) {
      return 'The difficulty climbed faster than your accuracy - another round at this level will let it settle.';
    }
    if (sess.accuracy != null && sess.accuracy >= 85 && sess.maxLevel < 10) {
      return 'You cleared this comfortably - expect harder items next time.';
    }
    if (sess.weakest) {
      return `${sess.weakest} lagged the rest - a focused session there would even out your profile.`;
    }
    return null;
  }
</script>

<svelte:head><title>Session complete - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-xl flex-col gap-8 pt-4 sm:pt-10">
  {#if !s}
    <div class="flex flex-col items-start gap-4">
      <p class="label">Session</p>
      <p class="text-muted">No completed attempts in this session yet.</p>
      <a href="/practice/run" class="btn-primary">{$t('w.startPracticing')}</a>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-2 text-center">
      <p class="label">Session complete</p>
      <p class="font-mono text-5xl">{s.attempts}</p>
      <p class="text-sm text-muted">attempts</p>
      {#if s.modulesUsed && s.modulesUsed.length > 0}
        <!-- The session's full story: bursts are part of the same session, so the summary says so. -->
        <p class="text-xs text-muted">
          also included:
          {#each [...new Set(s.modulesUsed)] as m, i}{i > 0 ? ' · ' : ' '}{m === 'retention' ? 'a Retention burst' : 'a Reaction run'}{/each}
        </p>
      {/if}
    </div>

    <div class="panel grid grid-cols-2 gap-px bg-edge p-0 sm:grid-cols-4">
      <div class="bg-surface p-4 text-center">
        <p class="label mb-1">Accuracy</p>
        <p class="font-mono text-xl {s.accuracy != null && s.accuracy >= 70 ? 'text-ok' : ''}">{s.accuracy ?? '-'}%</p>
      </div>
      <div class="bg-surface p-4 text-center">
        <p class="label mb-1">Avg time</p>
        <p class="font-mono text-xl">{fmtMs(s.avgMs)}</p>
      </div>
      <div class="bg-surface p-4 text-center">
        <p class="label mb-1">Levels</p>
        <p class="font-mono text-xl">{s.minLevel}-{s.maxLevel}</p>
      </div>
      <div class="bg-surface p-4 text-center">
        <p class="label mb-1">Rating</p>
        <p class="font-mono text-xl {s.ratingDelta != null && s.ratingDelta > 0 ? 'text-ok' : s.ratingDelta != null && s.ratingDelta < 0 ? 'text-bad' : ''}">{fmtDelta(s.ratingDelta)}</p>
      </div>
    </div>

    <p class="text-center text-sm text-muted">{narrative(s)}</p>

    {#if nextStep(s)}
      <p class="mx-auto max-w-md text-center text-sm text-accent/90">{nextStep(s)}</p>
    {/if}

    {#if s.strongest || s.weakest}
      <div class="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
        {#if s.strongest}
          <p class="text-muted">Strongest: <span class="text-ok">{s.strongest}</span></p>
        {/if}
        {#if s.weakest}
          <p class="text-muted">Focus area: <span class="text-accent">{s.weakest}</span></p>
        {/if}
      </div>
    {/if}

    {#if s.byCategory.length > 1}
      <div class="panel divide-y divide-edge">
        {#each s.byCategory as c}
          <div class="flex items-baseline justify-between px-4 py-2.5 text-sm">
            <span class="text-body">{c.name}</span>
            <span class="flex gap-4 font-mono text-muted">
              <span>{c.attempts}×</span>
              <span class="{c.accuracy >= 70 ? 'text-ok' : ''}">{c.accuracy}%</span>
              <span class="w-10 text-right {c.ratingDelta != null && c.ratingDelta > 0 ? 'text-ok' : c.ratingDelta != null && c.ratingDelta < 0 ? 'text-bad' : ''}">{fmtDelta(c.ratingDelta)}</span>
            </span>
          </div>
        {/each}
      </div>
    {/if}

    {#if data.anonymous}
      <div class="panel border-accent/40 p-4 text-center text-sm text-muted">
        Practicing anonymously - <a href="/auth/login" class="text-accent hover:underline">register</a> to keep this history.
      </div>
    {/if}

    <div class="flex flex-wrap justify-center gap-3">
      <a href="/review/{s.id}" class="btn">Review mistakes</a>
      <a href="/practice/run" class="btn-primary">Practice again</a>
      <a href="/stats" class="btn">Stats</a>
    </div>
  {/if}
</div>
