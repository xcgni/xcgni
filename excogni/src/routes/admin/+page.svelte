<script lang="ts">
  export let data;
  const pct = (x: number | null) => (x == null ? '-' : x + '%');
  const num = (x: number | null) => (x == null ? '·' : x.toLocaleString());
  const ci = (s: { mean: number | null; ci95: [number, number] | null; n: number }) =>
    s.mean == null ? 'suppressed' : `${s.mean}${s.ci95 ? ` (95% CI ${s.ci95[0]}-${s.ci95[1]})` : ''} · n=${s.n}`;
  const driftClass = (d: number | null) =>
    d == null ? 'text-muted' : Math.abs(d) >= 25 ? 'text-bad' : Math.abs(d) >= 10 ? 'text-accent' : 'text-ok';

  // Mnemonic 3-letter codes for the correlation matrix column headers (they must stay
  // narrow). Row labels show the full name; this legend decodes the columns.
  const CODE: Record<string, string> = {
    attention_control: 'ATT', estimation: 'EST', inhibition: 'INH', logical_reasoning: 'LOG',
    numerical_fluency: 'NUM', pattern_recognition: 'PAT', processing_speed: 'PRO',
    reaction_time: 'RXN', spatial_reasoning: 'SPA', task_switching: 'TSK',
    verbal_reasoning: 'VRB', verbal_fluency: 'VFL', visual_processing: 'VIS',
    working_memory: 'WM', retention: 'RET', retrieval_fluency: 'RTV'
  };
  const code = (slug: string) => CODE[slug] ?? slug.slice(0, 3).toUpperCase();
  const pretty = (slug: string) => slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
</script>

<div class="flex flex-col gap-10">
  <!-- data quality / validity -->
  <section>
    <p class="label mb-3">Data quality <span class="text-muted">(flagged, never deleted - so early data stays analysable)</span></p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="panel p-4">
        <p class="label">Clean attempts</p>
        <p class="font-mono text-2xl text-ok">{data.quality.totalAttempts > 0 ? Math.round((data.quality.cleanAttempts / data.quality.totalAttempts) * 100) : '·'}%</p>
        <p class="text-xs text-muted">{num(data.quality.cleanAttempts)} / {num(data.quality.totalAttempts)}</p>
      </div>
      {#each data.quality.flagged as f}
        <div class="panel p-4">
          <p class="label">{f.flag.replace('_', ' ')}</p>
          <p class="font-mono text-2xl {f.flag === 'first_exposure' ? '' : 'text-bad'}">{num(f.n)}</p>
          <p class="text-xs text-muted">{data.quality.totalAttempts > 0 ? Math.round((f.n / data.quality.totalAttempts) * 100) : 0}% of attempts</p>
        </div>
      {/each}
      <div class="panel p-4">
        <p class="label">Consent stamped</p>
        <p class="font-mono text-2xl">{data.quality.consentStamped} / {data.quality.consentTotal}</p>
        <p class="text-xs text-muted">with time + version</p>
      </div>
    </div>
    {#if data.quality.inputBreakdown.length > 0}
      <p class="mt-2 text-xs text-muted">
        Input method: {#each data.quality.inputBreakdown as im}{im.method} {num(im.n)} · {/each}
      </p>
    {/if}
  </section>

  <!-- website / traffic metrics (operational) -->
  <section>
    <p class="label mb-3">Website metrics <span class="text-muted">(real users, test/simulated excluded)</span></p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div class="panel p-4"><p class="label">Registered</p><p class="font-mono text-2xl">{num(data.site.registeredUsers)}</p></div>
      <div class="panel p-4"><p class="label">Anonymous</p><p class="font-mono text-2xl">{num(data.site.anonymousUsers)}</p></div>
      <div class="panel p-4"><p class="label">Active now</p><p class="font-mono text-2xl text-ok">{num(data.site.activeNow)}</p><p class="text-xs text-muted">last 15 min</p></div>
      <div class="panel p-4"><p class="label">Active today</p><p class="font-mono text-2xl">{num(data.site.activeToday)}</p></div>
      <div class="panel p-4"><p class="label">Practised</p><p class="font-mono text-2xl">{num(data.site.practisedRegistered)}</p><p class="text-xs text-muted">registered w/ attempts</p></div>
      <div class="panel p-4"><p class="label">Signups 24h</p><p class="font-mono text-2xl">{num(data.site.signups24h)}</p></div>
      <div class="panel p-4"><p class="label">Signups 7d</p><p class="font-mono text-2xl">{num(data.site.signups7d)}</p></div>
      <div class="panel p-4"><p class="label">Anon runs 24h</p><p class="font-mono text-2xl">{num(data.site.newAnon24h)}</p></div>
      <div class="panel p-4"><p class="label">Anon runs 7d</p><p class="font-mono text-2xl">{num(data.site.newAnon7d)}</p></div>
      <div class="panel p-4"><p class="label">Visits 24h</p><p class="font-mono text-2xl">{num(data.visits.visitsLast24h)}</p></div>
    </div>
  </section>

  <!-- referrers -->
    <!-- Instrumentation coverage: are the new measurement layers actually filling? -->
  <section class="flex flex-col gap-3">
    <p class="label">Instrumentation (new measurement layers)</p>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <div class="panel p-4"><p class="label">Baselines</p><p class="font-mono text-2xl">{num(data.instr.baselines)}</p><p class="text-xs text-muted">{num(data.instr.baseline_users)} users covered</p></div>
      <div class="panel p-4"><p class="label">Micro-signals 7d</p><p class="font-mono text-2xl">{data.instr.ans7 > 0 ? Math.round((data.instr.micro7 / data.instr.ans7) * 100) + '%' : '-'}</p><p class="text-xs text-muted">{num(data.instr.micro7)} of {num(data.instr.ans7)} attempts carry first-input</p></div>
      <div class="panel p-4"><p class="label">Fluency word-timed</p><p class="font-mono text-2xl">{num(data.instr.word_timed)}</p><p class="text-xs text-muted">attempts with word_times</p></div>
      <div class="panel p-4"><p class="label">Reaction runs</p><p class="font-mono text-2xl">{num(data.instr.reaction_runs)}</p><p class="text-xs text-muted">full series kept</p></div>
      <div class="panel p-4"><p class="label">Opt-ins</p><p class="font-mono text-2xl">{num(data.instr.reminders_on)}</p><p class="text-xs text-muted">reminders · {num(data.instr.conditionals_on)} conditional · {num(data.instr.decks_set)} deck prefs</p></div>
    </div>
  </section>

<section>
    <p class="label mb-3">Engagement &amp; retention <span class="text-muted">(the signal that matters - are people coming back?)</span></p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <div class="panel p-4">
        <p class="label">Return rate (7d)</p>
        <p class="font-mono text-2xl text-ok">{data.derived.returnRate7d == null ? '-' : Math.round(data.derived.returnRate7d * 100) + '%'}</p>
        <p class="text-xs text-muted">came back after first week</p>
      </div>
      <div class="panel p-4">
        <p class="label">Return rate (1d)</p>
        <p class="font-mono text-2xl">{data.derived.returnRate1d == null ? '-' : Math.round(data.derived.returnRate1d * 100) + '%'}</p>
        <p class="text-xs text-muted">practised on 2+ days</p>
      </div>
      <div class="panel p-4">
        <p class="label">Repeat users</p>
        <p class="font-mono text-2xl text-ok">{num(data.derived.repeatUsers)}</p>
        <p class="text-xs text-muted">2+ distinct days (validation-grade)</p>
      </div>
      <div class="panel p-4">
        <p class="label">One-and-done</p>
        <p class="font-mono text-2xl">{num(data.derived.oneAndDone)}</p>
        <p class="text-xs text-muted">tried once, never returned</p>
      </div>
      <div class="panel p-4">
        <p class="label">Avg practice days</p>
        <p class="font-mono text-2xl">{data.derived.avgSessionsPerUser ?? '-'}</p>
        <p class="text-xs text-muted">per user who practised</p>
      </div>
      <div class="panel p-4">
        <p class="label">Median attempts</p>
        <p class="font-mono text-2xl">{data.derived.medianAttemptsPerSession ?? '-'}</p>
        <p class="text-xs text-muted">per session</p>
      </div>
      <div class="panel p-4">
        <p class="label">Busiest hour</p>
        <p class="font-mono text-2xl">{data.derived.busiestHourUtc == null ? '-' : `${String(data.derived.busiestHourUtc).padStart(2, '0')}:00`}</p>
        <p class="text-xs text-muted">{data.derived.busiestHourShare == null ? 'local time' : Math.round(data.derived.busiestHourShare * 100) + '% of attempts'}</p>
      </div>
    </div>
    <p class="mt-2 text-xs text-muted">Return rate is the truest signal a training product works: a flood of one-time triers means little; people coming back is what validates it. Rates show '-' until there are at least 10 eligible users.</p>
  </section>

  <!-- referrers -->
  <section>
    <p class="label mb-3">Top referrers <span class="text-muted">(last 30 days, first-visit only)</span></p>
    {#if data.referrers.length === 0}
      <p class="panel p-5 text-sm text-muted">No referrer data yet. It accrues as people arrive - 'direct' means no referrer (typed URL, bookmark, or app).</p>
    {:else}
      <div class="panel overflow-x-auto p-4">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-muted"><th class="py-1 pr-4">source</th><th class="py-1">first visits</th></tr></thead>
          <tbody class="font-mono">
            {#each data.referrers as r}
              <tr><td class="py-1 pr-4 text-body">{r.host}</td><td class="py-1 text-accent">{num(r.n)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-muted">Visits (30d): {num(data.visits.visitsLast30d)} · (7d): {num(data.visits.visitsLast7d)}. Only the referrer host is stored, never linked to a person.</p>
    {/if}
  </section>

  <!-- vitals -->
  <section>
    <p class="label mb-3">Population vitals</p>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div class="panel p-4"><p class="label">Rated users</p><p class="font-mono text-2xl">{num(data.vitals.ratedUsers)}</p></div>
      <div class="panel p-4"><p class="label">Attempts</p><p class="font-mono text-2xl">{num(data.vitals.totalAttempts)}</p></div>
      <div class="panel p-4"><p class="label">Sessions</p><p class="font-mono text-2xl">{num(data.vitals.totalSessions)}</p></div>
      <div class="panel p-4"><p class="label">Last 7d</p><p class="font-mono text-2xl">{num(data.vitals.attemptsLast7d)}</p></div>
      <div class="panel p-4"><p class="label">Consented</p><p class="font-mono text-2xl">{num(data.vitals.consentedUsers)}</p></div>
      <div class="panel p-4"><p class="label">Consent rate</p><p class="font-mono text-2xl">{data.vitals.consentRate == null ? '-' : Math.round(data.vitals.consentRate * 100) + '%'}</p></div>
    </div>
    {#if data.vitals.consentRate != null && data.vitals.consentRate < 0.5}
      <p class="mt-2 text-xs text-accent">Selection bias caution: under half of users consented to attribute use, so attribute slices may not represent the whole population.</p>
    {/if}
  </section>

  <!-- rating distribution -->
  <section>
    <p class="label mb-3">Global rating distribution</p>
    {#if data.distribution.suppressed}
      <p class="panel p-5 text-sm text-muted">Too few rated users to display ({data.minCell} minimum).</p>
    {:else}
      <div class="panel p-5">
        <div class="flex items-end gap-1" style="height: 120px">
          {#each data.distribution.bins as b}
            {@const max = Math.max(...data.distribution.bins.map((x) => x.count))}
            <div class="flex flex-1 flex-col items-center justify-end gap-1">
              <div class="w-full bg-accent/50" style="height: {(b.count / max) * 100}%" title="{b.rating}: {b.count}"></div>
              <span class="text-[8px] text-muted">{b.rating}</span>
            </div>
          {/each}
        </div>
        <p class="mt-3 font-mono text-xs text-muted">
          mean {ci(data.distribution.summary)} · median {data.distribution.summary.median}
          {#if data.distribution.summary.iqr} · IQR {data.distribution.summary.iqr[0]}-{data.distribution.summary.iqr[1]}{/if}
        </p>
      </div>
    {/if}
  </section>

  <!-- category difficulty + median drift -->
  <section>
    <p class="label mb-3">Category difficulty &amp; observed-median drift</p>
    <div class="panel overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-edge text-left text-muted">
            <th class="px-4 py-2 font-normal">Category</th>
            <th class="px-4 py-2 text-right font-normal">Attempts</th>
            <th class="px-4 py-2 text-right font-normal">Accuracy</th>
            <th class="px-4 py-2 text-right font-normal">Avg level</th>
            <th class="px-4 py-2 text-right font-normal">Observed ms</th>
            <th class="px-4 py-2 text-right font-normal">Tuned ms</th>
            <th class="px-4 py-2 text-right font-normal">Drift</th>
          </tr>
        </thead>
        <tbody class="font-mono">
          {#each data.categories as c}
            <tr class="border-b border-edge/50">
              <td class="px-4 py-2 font-sans">{c.name}</td>
              <td class="px-4 py-2 text-right">{num(c.attempts)}</td>
              <td class="px-4 py-2 text-right">{pct(c.accuracy)}</td>
              <td class="px-4 py-2 text-right">{c.avgLevelReached ?? '·'}</td>
              <td class="px-4 py-2 text-right">{c.medianObservedMs ?? '·'}</td>
              <td class="px-4 py-2 text-right">{c.tunedMedianMs ?? '·'}</td>
              <td class="px-4 py-2 text-right {driftClass(c.medianDriftPct)}">{c.medianDriftPct == null ? '·' : (c.medianDriftPct > 0 ? '+' : '') + c.medianDriftPct + '%'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-muted">Drift = observed median response time vs the hand-tuned guess. Large drift flags a level whose timing target needs recalibration.</p>
  </section>

  <!-- verbal-by-language bias check -->
  <section>
    <p class="label mb-3">Verbal rating by native language <span class="text-muted">(bias check)</span></p>
    {#if data.verbalByLang.length === 0}
      <p class="panel p-5 text-sm text-muted">No language group is large enough to display yet ({data.minCell} minimum, consented only).</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.verbalByLang as g}
          <div class="flex items-baseline justify-between px-4 py-2 text-sm">
            <span class="font-sans">{g.language}</span>
            <span class="font-mono text-muted">{ci(g.summary)}</span>
          </div>
        {/each}
      </div>
      {#if data.verbalComparison && !data.verbalComparison.suppressed}
        <div class="panel mt-3 p-4 text-sm">
          <p class="text-muted">
            {data.verbalComparison.langA} vs {data.verbalComparison.langB}:
            difference <span class="font-mono text-body">{data.verbalComparison.meanDiff}</span>,
            effect size <span class="font-mono text-body">d={data.verbalComparison.cohensD}</span>
            <span class="text-accent">({data.verbalComparison.effectLabel})</span>.
          </p>
          {#if data.verbalComparison.mc.warn}
            <p class="mt-2 text-xs text-accent">
              Exploratory: comparing {data.verbalByLang.length} groups inflates false positives to
              ~{Math.round(data.verbalComparison.mc.familywiseFalsePositiveRate * 100)}%. Treat a single
              difference as a lead, not a finding; use threshold p&lt;{data.verbalComparison.mc.bonferroniThreshold}.
            </p>
          {/if}
        </div>
      {/if}
    {/if}
    <p class="mt-2 text-xs text-muted">A large effect here suggests the Verbal deck measures language familiarity, not reasoning - the per-language pools exist precisely to watch for this.</p>
  </section>

  <!-- test-retest reliability -->
  <section>
    <p class="label mb-3">Test-retest reliability <span class="text-muted">(per category)</span></p>
    {#if data.reliability.length === 0}
      <p class="panel p-5 text-sm text-muted">Not enough repeat measurements yet. Reliability needs users with multiple rated sessions per category.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.reliability as r}
          <div class="flex items-baseline justify-between px-4 py-2 text-sm">
            <span class="font-mono">{r.slug}</span>
            <span class="font-mono {r.icc != null && r.icc >= 0.7 ? 'text-ok' : r.icc != null && r.icc >= 0.5 ? 'text-accent' : 'text-bad'}">
              ICC≈{r.icc} · {r.subjects} subjects
            </span>
          </div>
        {/each}
      </div>
    {/if}
    <p class="mt-2 text-xs text-muted">ICC near 1 = the instrument ranks people consistently across sessions. This is the core validation question; below ~0.5 the rating is too noisy to trust as a stable measure.</p>
  </section>

  <!-- inter-category correlation (are domains distinct?) -->
  <section>
    <p class="label mb-3">Category correlations <span class="text-muted">(are categories distinct?)</span></p>
    {#if data.correlations.categories.length < 2}
      <p class="panel p-5 text-sm text-muted">Not enough rated categories to correlate yet.</p>
    {:else}
      <div class="panel overflow-x-auto p-4">
        <table class="text-xs">
          <thead>
            <tr>
              <th class="px-1 py-1"></th>
              {#each data.correlations.categories as c}
                <th class="px-1.5 py-1 font-mono text-muted" title={pretty(c)}>{code(c)}</th>
              {/each}
            </tr>
          </thead>
          <tbody class="font-mono">
            {#each data.correlations.matrix as row, i}
              <tr>
                <td class="whitespace-nowrap py-1 pr-3 text-right text-muted" title={data.correlations.categories[i]}>
                  {pretty(data.correlations.categories[i])} <span class="opacity-50">{code(data.correlations.categories[i])}</span>
                </td>
                {#each row as r}
                  <td class="px-1.5 py-1 text-center {r != null && r >= 0.8 && r < 1 ? 'text-bad' : r != null && r >= 0.6 ? 'text-accent' : 'text-muted'}">
                    {r == null ? '·' : r.toFixed(2)}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-muted">
        Columns use 3-letter codes (shown beside each row's full name). Diagonal is always 1.00; a pair near ±1 may not be distinct constructs.
      </p>
      {#if data.correlations.highPairs.length > 0}
        <p class="mt-2 text-xs text-bad">
          Highly correlated (r≥0.8), may not be distinct constructs:
          {#each data.correlations.highPairs as p}<span class="font-mono"> {pretty(p.a)}↔{pretty(p.b)} ({p.r}, n={p.n})</span>{/each}
        </p>
      {:else}
        <p class="mt-2 text-xs text-muted">No category pair exceeds r=0.8 - categories appear empirically distinct so far.</p>
      {/if}
    {/if}
  </section>

  <!-- practice effect (early vs late) -->
  <section>
    <p class="label mb-3">Practice effect <span class="text-muted">(early vs late sessions)</span></p>
    {#if !data.practice || data.practice.every((p) => p.gain == null)}
      <p class="panel p-5 text-sm text-muted">Not enough users with repeated sessions to separate practice from trait yet.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.practice.filter((p) => p.gain != null) as p}
          <div class="flex items-baseline justify-between px-4 py-2 text-sm">
            <span class="font-mono">{p.category}</span>
            <span class="font-mono text-muted">
              {p.earlyMean} → {p.lateMean}
              <span class="{p.gain > 80 ? 'text-bad' : p.gain > 30 ? 'text-accent' : 'text-ok'}">({p.gain > 0 ? '+' : ''}{p.gain})</span>
              · n={p.n}
            </span>
          </div>
        {/each}
      </div>
      <p class="mt-2 text-xs text-muted">A large early→late gain means the rating reflects practice/learning, not just stable ability. The rating measures a moving target; this quantifies how much it moves.</p>
    {/if}
  </section>

  <!-- external-criterion validity -->
  <section>
    <p class="label mb-3">External validity <span class="text-muted">(vs self-reported test scores)</span></p>
    {#if !data.validity || data.validity.length === 0}
      <p class="panel p-5 text-sm text-muted">No external test scores collected yet. Validity needs users to share an outside score in Settings.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.validity as v}
          <div class="flex items-baseline justify-between px-4 py-2 text-sm">
            <span class="font-mono uppercase">{v.testType}</span>
            <span class="font-mono {v.r == null ? 'text-muted' : v.r >= 0.5 ? 'text-ok' : v.r >= 0.3 ? 'text-accent' : 'text-bad'}">
              {v.r == null ? `n=${v.n} (too few)` : `r=${v.r} · n=${v.n}`}
            </span>
          </div>
        {/each}
      </div>
      <p class="mt-2 text-xs text-muted">Correlation between Excogni rating and an outside test. This is the only evidence that moves the rating from "consistent" to "valid" - a positive r here is the validation goal.</p>
    {/if}
  </section>

  <!-- consent / selection bias -->
  <section>
    <p class="label mb-3">Selection bias <span class="text-muted">(consenter vs non-consenter)</span></p>
    <div class="panel p-5 text-sm">
      {#if data.consentBias.gap == null}
        <p class="text-muted">Not enough users in both groups to compare ({data.minCell} minimum each).</p>
      {:else}
        <p class="text-muted">
          Consenters are rated at <span class="font-mono text-body">{Math.round((data.consentBias.ratedRateConsented ?? 0) * 100)}%</span>,
          non-consenters at <span class="font-mono text-body">{Math.round((data.consentBias.ratedRateNon ?? 0) * 100)}%</span>
          - a gap of <span class="font-mono {Math.abs(data.consentBias.gap) >= 0.1 ? 'text-bad' : 'text-ok'}">{(data.consentBias.gap * 100).toFixed(0)}pp</span>.
          {#if Math.abs(data.consentBias.gap) >= 0.1}
            <span class="text-bad">Consenters differ meaningfully from non-consenters - attribute slices are biased toward this group.</span>
          {:else}
            <span class="text-ok">The two groups look similar on engagement; selection bias appears modest.</span>
          {/if}
        </p>
      {/if}
    </div>
  </section>
</div>
