<script lang="ts">
  import RatingReadout from '$lib/components/RatingReadout.svelte';
  import RatingChart from '$lib/components/RatingChart.svelte';
  import RadarChart from '$lib/components/RadarChart.svelte';
  import RadarTimeline from '$lib/components/RadarTimeline.svelte';
  import Sparklines from '$lib/components/Sparklines.svelte';
  import PercentileBars from '$lib/components/PercentileBars.svelte';
  import ProgressWheel from '$lib/components/ProgressWheel.svelte';
  import Distribution from '$lib/components/Distribution.svelte';
  import Explain from '$lib/components/Explain.svelte';
  import { TAG_LABELS } from '$lib/tags';
  export let data;

  // Day-note editing state (attach a note to a flagged best/worst day).
  let noteEditing: string | null = null;   // the date currently being edited
  let noteDraft = '';
  let noteSaving = false;
  // local copy so saved notes show immediately without a reload
  let dayNotes: Record<string, string | null> = {};

  function startNote(date: string, existing: string | null) {
    noteEditing = date;
    noteDraft = existing ?? '';
  }
  async function saveNote() {
    if (!noteEditing) return;
    noteSaving = true;
    const date = noteEditing;
    try {
      const res = await fetch('/api/day-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, note: noteDraft.trim() })
      });
      if (res.ok) {
        dayNotes[date] = noteDraft.trim() || null;
        dayNotes = dayNotes;
        noteEditing = null;
      }
    } finally {
      noteSaving = false;
    }
  }
  function noteFor(d: { date: string; note: string | null }): string | null {
    return d.date in dayNotes ? dayNotes[d.date] : d.note;
  }

  let profileEl: HTMLDivElement;
  let exporting = false;

  // Serialize the radar SVG to a PNG on the user's machine - a shareable snapshot
  // of the cognitive profile, rendered on the app's ink background.
  async function exportProfile() {
    if (!profileEl || exporting) return;
    exporting = true;
    try {
      const svg = profileEl.querySelector('svg');
      if (!svg) return;
      const clone = svg.cloneNode(true) as SVGSVGElement;

      // CRITICAL: a detached/serialized SVG can't resolve CSS variables (it has no document context),
      // so any fill/stroke of `rgb(var(--c-accent))` - which is the "you (now)" plane, its vertex
      // dots and value labels - would render transparent and vanish from the export. Resolve the
      // theme's accent to a concrete colour and substitute it into the clone before serializing.
      const rootStyleEarly = getComputedStyle(document.documentElement);
      const accentTriplet = rootStyleEarly.getPropertyValue('--c-accent').trim();
      const accentConcrete = accentTriplet ? `rgb(${accentTriplet})` : '#E2A33B';
      for (const el of Array.from(clone.querySelectorAll('*'))) {
        for (const attr of ['fill', 'stroke']) {
          const val = el.getAttribute(attr);
          if (val && val.includes('var(--c-accent)')) {
            el.setAttribute(attr, accentConcrete);
          }
        }
      }
      const vb = svg.viewBox.baseVal;
      const w = vb && vb.width ? vb.width : 432;
      const rh = vb && vb.height ? vb.height : 320;
      const scale = 2; // crisp on retina
      clone.setAttribute('width', String(w));
      clone.setAttribute('height', String(rh));
      const xml = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('render failed'));
        img.src = url;
      });

      // Composed artifact: header band (wordmark + global rating), framed radar,
      // legend + footer (date + honest caption). Generous margins so it reads as a keepsake.
      const padX = 48, headerH = 96, legendH = 30, footerH = 56;
      const W = w + padX * 2;
      const H = headerH + rh + legendH + footerH;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);

      // Resolve a themed palette colour to a concrete rgb() string for canvas (canvas can't read CSS
      // vars). Reads the active theme from :root so the exported PNG matches what's on screen.
      const rootStyle = getComputedStyle(document.documentElement);
      const themed = (name: string, fallback: string) => {
        const v = rootStyle.getPropertyValue(name).trim();
        return v ? `rgb(${v})` : fallback;
      };
      const cAccent = themed('--c-accent', '#E2A33B');
      const cMuted = themed('--c-muted', '#8C95A3');
      const cBody = themed('--c-body', '#E8EAED');

      // background
      ctx.fillStyle = '#0A0C10';
      ctx.fillRect(0, 0, W, H);
      // subtle inner frame
      ctx.strokeStyle = '#202733';
      ctx.lineWidth = 1;
      ctx.strokeRect(16.5, 16.5, W - 33, H - 33);

      // header: wordmark (left) + global rating (right)
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = cBody;
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('EXCOGNI', padX, 56);
      ctx.fillStyle = cMuted;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('cognitive profile', padX, 74);
      // provenance footer: the exported image carries the same honesty as the page - which
      // methodology stamped it, and how many rated users the percentiles are measured against.


      const g = data.ratings?.global;
      if (g && g.rating != null) {
        ctx.textAlign = 'right';
        ctx.fillStyle = cAccent;
        ctx.font = '600 30px ui-monospace, monospace';
        ctx.fillText(String(g.rating), W - padX, 60);
        ctx.fillStyle = cMuted;
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(g.provisional ? 'global · calibrating' : 'global rating', W - padX, 76);

        // percentile, to the left of the rating, so the export carries the same headline standing
        // the app shows ("92nd"). Only when there's a real percentile (a rated pool exists).
        if (g.percentile != null) {
          const ratingW = ctx.measureText(String(g.rating)).width;
          const pctRightX = W - padX - Math.max(ratingW, 60) - 32;
          // measure "th" so we can right-align the number + suffix as one unit
          ctx.font = '12px system-ui, sans-serif';
          const thW = ctx.measureText('th').width;
          ctx.textAlign = 'left';
          ctx.fillStyle = cBody;
          ctx.font = '600 24px system-ui, sans-serif';
          const numStr = `${g.percentile}`;
          const numW = ctx.measureText(numStr).width;
          const startX = pctRightX - numW - thW - 2;
          ctx.fillText(numStr, startX, 58);
          ctx.fillStyle = cMuted;
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillText('th', startX + numW + 2, 58);
          ctx.textAlign = 'right';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText('percentile', pctRightX, 76);
        }
      }

      // header divider
      ctx.strokeStyle = '#202733';
      ctx.beginPath(); ctx.moveTo(padX, headerH - 12); ctx.lineTo(W - padX, headerH - 12); ctx.stroke();

      // the radar
      ctx.drawImage(img, padX, headerH, w, rh);

      // legend - explains the lines (only includes the ones actually shown)
      const hasRanges = (data.domainRanges?.length ?? 0) > 0;
      const hasPop = data.populationMedians?.some((p: { median: number | null }) => p.median != null) ?? false;
      if (hasRanges || hasPop) {
        const ly = headerH + rh + 18;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // build the entries actually present
        const entries: { color: string; dash: number[]; label: string; solid?: boolean }[] = [
          { color: cAccent, dash: [], label: 'you (now)', solid: true }
        ];
        if (hasRanges) {
          entries.push({ color: '#FFFFFF', dash: [8, 4], label: 'your best' });
          entries.push({ color: '#FF5A47', dash: [2, 4], label: 'your lowest' });
        }
        if (hasPop) entries.push({ color: '#4DA3FF', dash: [1, 5], label: 'everyone (median)' });

        // measure total width to center the legend row
        ctx.font = '10px system-ui, sans-serif';
        const lineW = 18, gap = 6, itemGap = 18;
        let totalW = 0;
        for (const e of entries) totalW += lineW + gap + ctx.measureText(e.label).width + itemGap;
        totalW -= itemGap;
        let lx = (W - totalW) / 2;

        for (const e of entries) {
          ctx.strokeStyle = e.color;
          ctx.fillStyle = e.color;
          ctx.lineWidth = e.solid ? 3 : 1.75;
          ctx.setLineDash(e.dash);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + lineW, ly);
          ctx.stroke();
          ctx.setLineDash([]);
          lx += lineW + gap;
          ctx.fillStyle = cMuted;
          ctx.fillText(e.label, lx, ly);
          lx += ctx.measureText(e.label).width + itemGap;
        }
        ctx.textBaseline = 'alphabetic';
      }

      // footer: date (left) + honest caption (right)
      const y = H - 24;
      ctx.fillStyle = cMuted;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      // one bottom-left line: date + provenance (two separate draws overlapped here before)
      const poolN = data.ratings?.global?.poolSize;
      ctx.fillText(
        `${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · methodology ${data.methodologyVersion}${poolN ? ` · vs ${poolN} rated users` : ''}`,
        padX, y
      );
      ctx.textAlign = 'right';
      ctx.fillText('a shape, not a score · not a clinical measure', W - padX, y);

      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `excogni-profile-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // silent - export is best-effort
    } finally {
      exporting = false;
    }
  }

  $: implemented = data.ratings ? data.ratings.categories.filter((c) => c.implemented) : [];
  $: rated = data.ratings ? data.ratings.categories.filter((c) => c.rating != null) : [];

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const EXPLAIN = {
    rating: 'Your rating blends the level you have stabilized at with your recent accuracy and pace. It is a single number on a roughly 600-1900 scale. It is relative, not an absolute measure of ability.',
    percentile: 'Where you stand against other rated users: "70th percentile" means you score higher than 70% of them. It needs a real pool to mean anything, so it reads "calibrating" until enough people are rated.',
    domain: 'A cognitive domain groups related categories (e.g. Fluid Reasoning covers logical, spatial and pattern tasks). The domain score is a confidence-weighted blend of its categories. A dot means only some of its categories are rated so far.',
    peak: 'Your personal best: the highest rating and level you have reached in this category, with the date you reached it. Like a chess peak rating - it only goes up, and records a real moment.',
    distribution: 'The shape of the whole rated population, with a marker for you. No names and no ranking of individuals - just where you sit in the field.',
    fingerprint: 'Your cognitive profile across domains. Each axis is one domain; the polygon is the shape of your strengths. Dim axes are domains you have not measured yet, not zeros.',
    executive: 'Difference scores that isolate the executive component from raw speed. Interference is how much a conflicting word slows you (the Stroop effect); switch cost is the extra time a rule-change costs. Smaller is better, and these are more construct-valid than raw accuracy.'
  };
</script>

<svelte:head><title>Dashboard - Excogni</title></svelte:head>

{#if !data.ratings || rated.length === 0}
  <div class="flex flex-col items-start gap-4 py-12">
    <p class="label">Your stats</p>
    <p class="text-muted">No measurements yet. Head to the Practice tab and your stats will appear here.</p>
    <div class="flex flex-wrap gap-3">
      <a href="/practice" class="btn-primary">Go to practice</a>
      <a href="/statistics" class="btn">Global stats →</a>
    </div>
  </div>
{:else}
  <div class="flex flex-col gap-10">
    <!-- header: this is the user's stats home; practice lives in the Practice tab -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="label">Your stats</p>
      <a href="/statistics" class="btn">Global stats →</a>
    </div>

    {#if data.anonymous}
      <div class="panel border-accent/40 p-4 text-sm text-muted">
        You are practicing anonymously: your results stay yours alone and do NOT join the
        population pool or percentiles. Registering (an email, nothing more) is what lets your
        data count - the email exists to make fake and duplicate data harder, not to identify
        you; aggregates never carry any identity.
        <a href="/auth/login" class="text-accent hover:underline">Register</a> to contribute and
        keep your history across devices.
      </div>
    {/if}

    <!-- Headline: state + direction at a glance (the 5-second test) -->
    {#if data.headline}
      <div class="panel flex items-center gap-3 border-l-2 p-4 {data.headline.tone === 'up' ? 'border-l-ok' : data.headline.tone === 'down' ? 'border-l-bad' : 'border-l-edge'}">
        <p class="text-sm text-body">{data.headline.text}</p>
      </div>
    {/if}

    <!-- Completeness ring: honest progress toward valid stats + insights. Hidden once full. -->
    {#if data.readiness && data.readiness.overallPct < 100}
      <section class="panel p-5">
        <ProgressWheel readiness={data.readiness} missing={data.missing ?? null} />
      </section>
    {/if}

    <!-- Hero: the headline NUMBER first - overall rating + percentile, the thing people came for -->
    {#if data.ratings && data.ratings.global.rating != null}
      <section class="panel flex flex-wrap items-end justify-between gap-4 p-4 sm:gap-6 sm:p-6">
        <div class="flex flex-col gap-1">
          <p class="label flex items-center">Your rating <Explain text={EXPLAIN.rating} /></p>
          <div class="flex items-baseline gap-3">
            <span class="font-mono text-5xl text-accent">{data.ratings.global.rating}</span>
            {#if data.ratings.global.sem != null}
              <span class="font-mono text-sm text-muted">± {data.ratings.global.sem}</span>
            {/if}
            {#if data.ratings.global.provisional}
              <span class="label text-muted">provisional</span>
            {/if}
          </div>
          {#if data.ratings.global.sem != null}
            <div class="relative mt-1 h-1 w-44" title="± standard error on a fixed ±150 scale - narrower is more settled">
              <div class="absolute inset-y-0 left-0 w-full bg-edge/60"></div>
              <div class="absolute inset-y-0 bg-accent/50" style="left: {50 - Math.min(100, (data.ratings.global.sem / 150) * 100) / 2}%; width: {Math.min(100, (data.ratings.global.sem / 150) * 100)}%"></div>
              <div class="absolute inset-y-0 w-px bg-accent" style="left: 50%"></div>
            </div>
          {/if}
        </div>
        <div class="flex flex-col gap-1">
          <p class="label flex items-center">Percentile <Explain text={EXPLAIN.percentile} /></p>
          {#if data.ratings.global.percentile != null}
            <span class="font-mono text-3xl text-body">{data.ratings.global.percentile}<span class="text-lg text-muted">th</span></span>
            {#if data.ratings.global.aboveCount != null}
              <!-- anonymous population position: plain counts, never names -->
              <span class="text-xs text-muted">{data.ratings.global.aboveCount === 0 ? `top of ${data.ratings.global.poolSize} rated` : `${data.ratings.global.aboveCount} of ${data.ratings.global.poolSize} rated score above you`}</span>
            {/if}
            {#if data.ratings.global.baseline}
              <!-- baseline vs now: your first calibrated rating against everyone's first (test-naive
                   vs test-naive), plus improvement since. Honest note: gains on these tasks include
                   task familiarity, not only cognition. -->
              <span class="text-xs text-muted" title="Your first calibrated rating compared against everyone else's first. Improvement on these tasks includes task familiarity, not only cognitive change.">
                starting point: {data.ratings.global.baseline.percentile != null ? `${data.ratings.global.baseline.percentile}th of first-test spread` : `rating ${data.ratings.global.baseline.rating} (spread calibrating)`}
                {#if data.ratings.global.improvement}
                  · since calibration: {data.ratings.global.improvement.points >= 0 ? '+' : ''}{data.ratings.global.improvement.points}{data.ratings.global.improvement.poolMedianPoints != null ? ` (typical: ${data.ratings.global.improvement.poolMedianPoints >= 0 ? '+' : ''}${data.ratings.global.improvement.poolMedianPoints}, N=${data.ratings.global.improvement.poolN})` : ''}
                {/if}
              </span>
            {/if}
          {:else}
            <span class="font-mono text-2xl text-muted">calibrating</span>
          {/if}
        </div>
        {#if data.ratings.global.delta7d != null && data.ratings.global.delta7d !== 0}
          <div class="flex flex-col gap-1">
            <p class="label">Last 7 days</p>
            <span class="font-mono text-2xl {data.ratings.global.delta7d > 0 ? 'text-ok' : 'text-bad'}">{data.ratings.global.delta7d > 0 ? '+' : ''}{data.ratings.global.delta7d}</span>
          </div>
        {/if}
      </section>

    <!-- Findings (v1.5.0): the instrument speaks. Each unlocks past its own statistical bar;
         locked ones say exactly what is missing. Rare and correct beats chatty. -->
    {#if data.findings && data.findings.length}
      <section class="flex flex-col gap-3">
        <h2 class="label flex items-center">Findings <Explain text="Personal patterns computed from your own attempts. Each finding unlocks only when it clears a minimum sample and effect size - below that, it tells you what would unlock it. Associations, never causes." /></h2>
        <div class="flex flex-col gap-2">
          {#each data.findings as f (f.id)}
            <div class="panel flex flex-col gap-1 p-4 {f.unlocked ? '' : 'opacity-70'}">
              <div class="flex items-baseline justify-between gap-3">
                <p class="label">{f.title}</p>
                {#if !f.unlocked}<span class="font-mono text-[10px] text-muted">locked</span>
                {:else if f.effect === 0}<span class="font-mono text-[10px] text-muted">no effect</span>{/if}
              </div>
              <p class="text-sm {f.unlocked ? 'text-body' : 'text-muted'}">{f.sentence}</p>
              <p class="text-xs text-muted">{f.detail}</p>
            </div>
          {/each}
        </div>
        <p class="text-xs text-muted">The pool has findings of its own:
          <a href="/statistics/findings" class="underline hover:text-body">findings from the pool</a>.</p>
      </section>
    {/if}

    {/if}

    <!-- 0. Cognitive fingerprint -->
    {#if data.domains && data.domains.length >= 3}
      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3">
          <p class="label flex items-center">Cognitive profile <Explain text={EXPLAIN.fingerprint} /></p>
          <div class="flex items-center gap-2">
            <!-- the share moment: the badge option lives where pride happens, not buried in Settings -->
            {#if data.user && !data.user.isAnonymous && !data.publicBadge}
              <a href="/settings#public-badge" class="text-xs text-muted hover:text-accent">enable a live badge →</a>
            {/if}
            <button class="btn text-xs" on:click={exportProfile}>{exporting ? 'Exporting…' : 'Save as image'}</button>
          </div>
        </div>
        {#if data.publicBadge && data.user?.username}
          <p class="text-xs text-muted">Your live badge (embeds anywhere, updates itself):
            <a href={`/badge/${data.user.username}.svg`} class="font-mono text-accent hover:underline" target="_blank" rel="noopener">/badge/{data.user.username}.svg</a>
          </p>
        {/if}
        <div class="panel p-5" bind:this={profileEl}>
          <RadarChart domains={data.domains} ranges={data.domainRanges} population={data.populationMedians} />
          <p class="mt-2 text-center text-[10px] text-muted">
            computed under <a href="/methodology" class="text-accent hover:underline">methodology {data.methodologyVersion}</a>{#if data.ratings?.global?.poolSize} · percentiles vs {data.ratings.global.poolSize} rated users{/if}
          </p>
          {#if data.simulatedPopulation}
            <p class="mt-1 text-center text-[10px] text-accent/80">
              The population comparison (blue) currently includes simulated data while we gather enough real users. Your own scores are real.
            </p>
          {/if}
          {#if data.domainRanges && data.domainRanges.length > 0}
            <div class="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
              <span class="flex items-center gap-1.5"><span class="inline-block h-2 w-3 rounded-sm" style="background:rgb(var(--c-accent))"></span><span class="text-muted">you (now)</span></span>
              <span class="flex items-center gap-1.5"><svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#FFFFFF" stroke-width="1.75" stroke-dasharray="8 4"/></svg><span class="text-muted">your best</span></span>
              <span class="flex items-center gap-1.5"><svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#FF5A47" stroke-width="1.75" stroke-dasharray="2 4"/></svg><span class="text-muted">your lowest</span></span>
              {#if data.populationMedians && data.populationMedians.some((p) => p.median != null)}
                <span class="flex items-center gap-1.5"><svg width="16" height="6"><circle cx="8" cy="3" r="3" fill="#4DA3FF"/></svg><span class="text-muted">everyone (median)</span></span>
              {/if}
            </div>
            <p class="mt-1 text-center text-xs text-muted">
              Solid amber is your current shape - a real snapshot. The faint planes are your best
              and lowest in each area over time; those peaks didn't all happen at once.
            </p>
            {#if data.populationMedians && data.populationMedians.some((p) => p.median != null)}
              <p class="mx-auto mt-2 max-w-md text-center text-xs text-muted">
                A note on the "everyone" reference: Excogni's users are mostly people who seek out
                cognitive training, not a random cross-section. Sitting below this median doesn't mean
                below-average in the wider population - you're being compared to an unusually engaged group.
              </p>
            {/if}
          {/if}
        </div>
      </section>
    {/if}

    <!-- 0a-i. Percentile standing: where you rank vs everyone, per area -->
    {#if data.percentiles.some((p) => p.percentile != null)}
      <section class="flex flex-col gap-3">
        <p class="label">Where you stand</p>
        <div class="panel p-4">
          <PercentileBars percentiles={data.percentiles} />
        </div>
      </section>
    {/if}

    <!-- 0a-ii. Radar through time: scrub/play your shape across your history -->
    {#if data.timeline.length >= 2}
      <section class="flex flex-col gap-3">
        <p class="label">Your shape over time</p>
        <div class="panel p-4">
          <RadarTimeline domains={data.domains} snapshots={data.timeline} population={data.populationMedians} />
        </div>
      </section>
    {/if}

    <!-- 0a-iii. Per-domain trend sparklines: which areas are moving -->
    {#if data.sparklines.length > 0}
      <section class="flex flex-col gap-3">
        <p class="label">Trends by area</p>
        <Sparklines sparklines={data.sparklines} />
        <p class="text-xs text-muted">Each line is a domain's rating over your history - green trending up, red down, grey roughly flat.</p>
      </section>
    {/if}

    <!-- 0b. Insights - honest, correlational patterns from your logged context -->
    <section class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between">
        <p class="label">Insights</p>
        {#if data.insights.state === 'ok'}
          <span class="label text-muted">{data.insights.sessionCount} sessions analysed</span>
        {/if}
      </div>

      {#if data.insights.state === 'not_enough_data'}
        <div class="panel p-5">
          <p class="text-sm text-muted">
            A few more sessions and insights start appearing. Keep practising and logging how you feel -
            each pattern (how sleep, caffeine, alertness, mood or time of day relates to your performance)
            shows up here as soon as there's enough of your own data to back it, and more arrive over time.
          </p>
        </div>
      {:else if data.insights.state === 'no_patterns'}
        <div class="panel p-5">
          <p class="text-sm text-muted">
            No strong patterns yet. Your performance doesn't clearly track any single factor we log so far -
            which is itself honest information. As more sessions accumulate, real patterns (if any) will surface here.
          </p>
        </div>
      {:else}
        <div class="flex flex-col gap-2">
          {#each data.insights.insights as ins}
            <div class="panel flex items-start justify-between gap-4 p-4">
              <div class="flex flex-col gap-1">
                <p class="text-sm text-body">{ins.text}</p>
                <p class="text-xs text-muted">{ins.basis}{ins.vsPopulation ? ' · vs community' : ''}</p>
              </div>
              <span
                class="shrink-0 rounded border px-2 py-0.5 text-xs {ins.confidence === 'strong' ? 'border-ok/40 text-ok' : 'border-edge text-muted'}"
              >{ins.confidence}</span>
            </div>
          {/each}
          <p class="mt-1 text-xs text-muted">
            These are correlations in your own data, not proven causes - they describe what tends to go together,
            and they update or disappear as your data changes.
          </p>
        </div>
      {/if}
    </section>

    <!-- 4. Your patterns (only once there's enough data to mean it) -->
    {#if data.patterns && data.patterns.enoughData}
      <section class="flex flex-col gap-4">
        <p class="label">Your patterns</p>

        {#if data.patterns.bestHour}
          <div class="panel p-5">
            <p class="text-sm text-muted">
              You tend to perform best around
              <span class="font-mono text-accent">{data.patterns.bestHour.label}</span>
              <span class="text-muted">({data.patterns.bestHour.accuracy}% accuracy over {data.patterns.bestHour.attempts} attempts)</span>.
            </p>
            {#if data.patterns.fatigueSignal && data.patterns.fatigueSignal !== 'flat'}
              <p class="mt-2 text-sm text-muted">
                Within a session your scores tend to
                <span class={data.patterns.fatigueSignal === 'improves' ? 'text-ok' : 'text-bad'}>
                  {data.patterns.fatigueSignal === 'improves' ? 'rise as you warm up' : 'drop as you tire'}
                </span>.
              </p>
            {/if}
          </div>
        {/if}

        {#if data.patterns.byHour.length > 0}
          <div class="panel p-5">
            <p class="label mb-3">Accuracy by time of day</p>
            <div class="flex items-end gap-1" style="height: 96px">
              {#each data.patterns.byHour as h}
                <div class="flex flex-1 flex-col items-center justify-end gap-1">
                  <div class="w-full bg-accent/70" style="height: {Math.max(2, h.accuracy)}%" title="{h.label}: {h.accuracy}%"></div>
                  <span class="text-[9px] text-muted">{h.key}</span>
                </div>
              {/each}
            </div>
            <p class="mt-2 text-xs text-muted">Local time · only hours with enough attempts are shown.</p>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Retention reviews at a glance: what the schedule holds, without entering a session -->
    {#if data.reviews && data.reviews.seen > 0}
      <section class="flex flex-col gap-3">
        <p class="label">Retention reviews</p>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="panel p-4"><p class="label">Due now</p><p class="font-mono text-2xl {data.reviews.due_now > 0 ? 'text-accent' : ''}">{data.reviews.due_now}</p></div>
          <div class="panel p-4"><p class="label">Due in 24h</p><p class="font-mono text-2xl">{data.reviews.due_24h}</p></div>
          <div class="panel p-4"><p class="label">Retained</p><p class="font-mono text-2xl text-ok">{data.reviews.retained}</p><p class="text-xs text-muted">held ≥ 7 days</p></div>
          <div class="panel p-4"><p class="label">Cards seen</p><p class="font-mono text-2xl">{data.reviews.seen}</p></div>
        </div>
        <p class="text-xs text-muted">Reviews come to you inside practice sessions when they are due - this is the schedule's honest state, not a to-do list.</p>
      </section>
    {/if}

    <!-- 0c. Persistence - consistency of showing up, measured as a trait (not a guilt-streak) -->
    {#if data.persistence.totalActiveDays > 0}
      <section class="flex flex-col gap-3">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <p class="label">Persistence</p>
          <span class="label text-muted">showing up - willpower &amp; organisation</span>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="panel p-4"><p class="label">Current run</p><p class="font-mono text-2xl text-ok">{data.persistence.currentRun}</p><p class="text-xs text-muted">days in a row</p></div>
          <div class="panel p-4"><p class="label">Longest run</p><p class="font-mono text-2xl">{data.persistence.longestRun}</p><p class="text-xs text-muted">days</p></div>
          <div class="panel p-4"><p class="label">Last 30 days</p><p class="font-mono text-2xl">{data.persistence.daysLast30}</p><p class="text-xs text-muted">days practised</p></div>
          <div class="panel p-4"><p class="label">Total</p><p class="font-mono text-2xl">{data.persistence.totalActiveDays}</p><p class="text-xs text-muted">active days</p></div>
          {#if data.spelling.accuracyPct != null}
            <div class="panel p-4"><p class="label">Spelling</p><p class="font-mono text-2xl">{data.spelling.accuracyPct}%</p><p class="text-xs text-muted">clean over {data.spelling.typedWords} typed</p></div>
          {/if}
        </div>

        <!-- calendar heat-strip: each column is a week, each cell a day; ends on today -->
        <div class="panel p-4">
          <div class="flex justify-center gap-1">
            {#each data.persistence.weeks as week}
              <div class="flex flex-col gap-1">
                {#each week as day}
                  <!-- shade = that day's average score, so the calendar shows HOW days went, not just that they happened -->
                  <div
                    class="h-3 w-3 rounded-sm {day.future ? 'opacity-0' : day.active ? 'bg-accent' : 'bg-edge/40'}"
                    style={day.active && day.perf != null ? `opacity:${(0.35 + 0.65 * Math.min(1, Math.max(0, day.perf))).toFixed(2)}` : ''}
                    title={day.active ? `${day.date} · ${day.n} attempts · avg ${Math.round((day.perf ?? 0) * 100)}%` : day.date}
                  ></div>
                {/each}
              </div>
            {/each}
          </div>
          <p class="mt-3 text-xs text-muted">
            Each square is a day; filled means you practised, and the shade is that day's average
            score (brighter = better). This measures consistency - a behavioural trait, not a
            cognitive one - so it sits beside your radar, not on it. There's no penalty for gaps;
            rest is part of any real routine.
          </p>
        </div>
      </section>
    {/if}

    <!-- Progressive disclosure: the detailed breakdowns live behind an expander so the page leads
         with the at-a-glance picture and doesn't overwhelm. Open it for the deeper numbers. -->
    <details class="group flex flex-col gap-4">
      <summary class="label flex cursor-pointer list-none items-center gap-2 py-2 text-muted hover:text-body">
        <span class="transition-transform group-open:rotate-90">▸</span> More detail - overall, progress, categories, patterns, records, distribution
      </summary>

    <!-- 1. Overall -->
    <section class="flex flex-col gap-4">
      <p class="label flex items-center">Overall <Explain text={EXPLAIN.rating} /></p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RatingReadout
          label="Global rating"
          rating={data.ratings.global.rating}
          percentile={data.ratings.global.percentile}
          status={data.ratings.global.status}
          confidence={data.ratings.global.confidence}
          provisional={data.ratings.global.provisional}
          poolSize={data.ratings.global.poolSize}
          delta={data.ratings.global.delta7d}
          sem={data.ratings.global.sem}
          big
        />
        <div class="panel flex flex-col justify-center p-5 sm:col-span-2">
          <p class="label mb-2">How rating works</p>
          <p class="text-sm text-muted">
            Your rating blends the level you've stabilized at with your recent accuracy and pace.
            Percentiles are norm-referenced against other rated users - until enough people are
            rated in a category, that category shows as <span class="text-accent">calibrating</span>
            rather than a fabricated number.
          </p>
        </div>
      </div>
    </section>

    <!-- 2. Progress -->
    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="label">Rating over time</p>
        <div class="flex flex-wrap gap-1 text-xs">
          <a href="/stats" class="px-2.5 py-1 {data.category == null ? 'text-accent' : 'text-muted hover:text-body'}">All</a>
          {#each implemented as c}
            {#if c.rating != null}
              <a href="/stats?cat={c.slug}" class="px-2.5 py-1 {data.category === c.slug ? 'text-accent' : 'text-muted hover:text-body'}">{c.name}</a>
            {/if}
          {/each}
        </div>
      </div>
      <div class="panel p-5">
        <RatingChart points={data.history} />
      </div>
    </section>

    <!-- 3. Categories -->
    <section class="flex flex-col gap-4">
      <p class="label">By category</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {#each implemented as cat}
          <RatingReadout
            label={cat.name}
            rating={cat.rating}
            percentile={cat.percentile}
            status={cat.status}
            confidence={cat.confidence}
            provisional={cat.provisional}
            poolSize={cat.poolSize}
            delta={cat.delta7d}
            sem={cat.sem}
            spark={data.categorySparks?.[cat.slug] ?? null}
            href={cat.rating != null ? `/stats?cat=${cat.slug}` : null}
          />
        {/each}
      </div>

      {#if data.showDebug && data.simulatedPool}
        <p class="text-xs text-muted">
          [debug] Percentiles currently include a simulated reference population. They switch to
          real users only once the platform has enough of them and the simulated flag is off.
        </p>
      {/if}
    </section>

    <!-- Best / worst performing days: surfaced early (3+ qualifying days) but honestly labelled as
         limited until there's enough history. Each day shows its self-reported tags and lets the user
         attach a retrospective note ("why was this a good/bad day"). -->
    {#if data.bestWorst && (data.bestWorst.best.length > 0 || data.bestWorst.worst.length > 0)}
      <section class="flex flex-col gap-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="label flex items-center">Your best &amp; toughest days <Explain text="The days where your average score across all attempts was highest and lowest. Only days with enough attempts to be a fair sample are counted. Attach a note to remember what made a day good or hard - sleep, stress, mood - and start to see your own patterns." /></p>
          {#if data.bestWorst.limited}
            <span class="text-xs text-muted">early - based on {data.bestWorst.qualifyingDays} day{data.bestWorst.qualifyingDays === 1 ? '' : 's'}, will steady with more</span>
          {/if}
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          {#each [{ list: data.bestWorst.best, label: 'Best', tone: 'text-ok' }, { list: data.bestWorst.worst, label: 'Toughest', tone: 'text-bad' }] as group}
            <div class="panel flex flex-col gap-3 p-4">
              <p class="label {group.tone}">{group.label}</p>
              {#each group.list as d}
                <div class="flex flex-col gap-1.5 border-t border-edge/60 pt-2 first:border-0 first:pt-0">
                  <div class="flex items-baseline justify-between gap-2">
                    <span class="font-mono text-sm text-body">{d.date}</span>
                    <span class="font-mono text-xs text-muted">{d.avgScore} avg · {d.attempts} attempts</span>
                  </div>
                  {#if d.tags && d.tags.length > 0}
                    <div class="flex flex-wrap gap-1">
                      {#each d.tags as t}
                        <span class="rounded bg-edge/50 px-1.5 py-0.5 text-[11px] text-muted">{TAG_LABELS[t] ?? t}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if noteEditing === d.date}
                    <div class="flex flex-col gap-2">
                      <textarea bind:value={noteDraft} rows="2" placeholder="What made this day good or hard?" class="field text-sm"></textarea>
                      <div class="flex gap-2">
                        <button class="btn-primary text-xs" on:click={saveNote} disabled={noteSaving}>{noteSaving ? 'Saving…' : 'Save note'}</button>
                        <button class="btn text-xs" on:click={() => (noteEditing = null)} disabled={noteSaving}>Cancel</button>
                      </div>
                    </div>
                  {:else if noteFor(d)}
                    <button class="text-left text-xs text-muted hover:text-body" on:click={() => startNote(d.date, noteFor(d))}>
                      <span class="text-body">{noteFor(d)}</span> <span class="text-accent">· edit</span>
                    </button>
                  {:else}
                    <button class="self-start text-xs text-accent hover:underline" on:click={() => startNote(d.date, null)}>+ add note</button>
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </section>
    {/if}
    {#if data.executive && (data.executive.interference?.available || data.executive.switchCost?.available)}
      <section class="flex flex-col gap-4">
        <p class="label flex items-center">Executive function <Explain text={EXPLAIN.executive} /></p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {#if data.executive.interference?.available}
            <div class="panel p-5">
              <p class="label mb-1">Stroop interference</p>
              <p class="font-mono text-2xl text-accent">+{data.executive.interference.interferenceMs}<span class="text-sm text-muted"> ms</span></p>
              <p class="mt-2 text-xs text-muted">
                How much the conflicting word slows you ({data.executive.interference.conditionMs}ms vs
                {data.executive.interference.baselineMs}ms baseline). Smaller = stronger inhibition.
                This isolates control from raw speed.
              </p>
            </div>
          {/if}
          {#if data.executive.switchCost?.available}
            <div class="panel p-5">
              <p class="label mb-1">Switch cost</p>
              <p class="font-mono text-2xl text-accent">+{data.executive.switchCost.switchCostMs}<span class="text-sm text-muted"> ms</span></p>
              <p class="mt-2 text-xs text-muted">
                The extra time a rule-change costs you ({data.executive.switchCost.conditionMs}ms switch vs
                {data.executive.switchCost.baselineMs}ms repeat). Smaller = more flexible. This isolates
                flexibility from general ability.
              </p>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- 5. Personal records -->
    {#if data.records && data.records.length > 0}
      <section class="flex flex-col gap-4">
        <p class="label flex items-center">Personal records <Explain text={EXPLAIN.peak} /></p>
        <div class="panel divide-y divide-edge">
          {#each data.records as r}
            <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3 text-sm">
              <span class="text-body">{r.name}</span>
              <span class="flex flex-wrap gap-x-6 font-mono text-muted">
                {#if r.peakRating != null}
                  <span>peak <span class="text-accent">{r.peakRating}</span>{#if r.peakRatingAt}<span class="text-muted"> · {fmtDate(r.peakRatingAt)}</span>{/if}</span>
                {/if}
                {#if r.maxLevel != null}
                  <span>max level <span class="text-body">{r.maxLevel}</span>{#if r.maxLevelAt}<span class="text-muted"> · {fmtDate(r.maxLevelAt)}</span>{/if}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- 6. The field (anonymous distribution) -->
    {#if data.distribution}
      <section class="flex flex-col gap-4">
        <p class="label flex items-center">The field <Explain text={EXPLAIN.distribution} /></p>
        <div class="panel p-5">
          <Distribution
            buckets={data.distribution.buckets}
            userRating={data.distribution.userRating}
            poolSize={data.distribution.poolSize}
          />
        </div>
      </section>
    {/if}

    <!-- 7. Last session (merged from the former dashboard) -->
    {#if data.lastSession}
      <section>
        <div class="mb-3 flex items-baseline justify-between">
          <p class="label">Last session</p>
          <a href="/review/{data.lastSession.id}" class="text-xs text-accent hover:underline">review →</a>
        </div>
        <div class="panel grid grid-cols-2 gap-px bg-edge p-0 sm:grid-cols-4">
          <div class="bg-surface p-4">
            <p class="label mb-1">Attempts</p>
            <p class="font-mono text-xl">{data.lastSession.attempts}</p>
          </div>
          <div class="bg-surface p-4">
            <p class="label mb-1">Accuracy</p>
            <p class="font-mono text-xl">{data.lastSession.accuracy ?? '-'}%</p>
          </div>
          <div class="bg-surface p-4">
            <p class="label mb-1">Avg response</p>
            <p class="font-mono text-xl">
              {data.lastSession.avgMs ? (data.lastSession.avgMs / 1000).toFixed(1) + 's' : '-'}
            </p>
          </div>
          <div class="bg-surface p-4">
            <p class="label mb-1">Levels</p>
            <p class="font-mono text-xl">{data.lastSession.minLevel}-{data.lastSession.maxLevel}</p>
          </div>
        </div>
      </section>
    {/if}
    </details>
  </div>
{/if}
