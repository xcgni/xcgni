<script lang="ts">
  export let data;
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  $: maxH = Math.max(1, ...data.trends.byHour.map((x) => x.accuracy));
  $: maxD = Math.max(1, ...data.trends.byDow.map((x) => x.accuracy));
  $: maxM = Math.max(1, ...data.trends.byMonth.map((x) => x.accuracy));
</script>

<div class="flex flex-col gap-8">
  <div>
    <p class="label mb-1">Temporal trends</p>
    <p class="text-sm text-muted">When the population performs, by local time. Local-time aggregates assume a stable timezone per user; cross-check by country when a cohort may travel. All cells respect the {data.minCell}-minimum floor.</p>
  </div>

  <form method="GET" class="panel flex flex-wrap gap-4 p-4">
    <label class="flex flex-col gap-1">
      <span class="label">Country</span>
      <select name="country" class="field">
        <option value="">any</option>
        {#each data.options.country ?? [] as v}<option value={v} selected={data.filters.country === v}>{v}</option>{/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="label">Native language</span>
      <select name="lang" class="field">
        <option value="">any</option>
        {#each data.options.native_language ?? [] as v}<option value={v} selected={data.filters.nativeLanguage === v}>{v}</option>{/each}
      </select>
    </label>
    <div class="flex items-end gap-2"><button class="btn-primary">Apply</button><a href="/admin/temporal" class="btn">Reset</a></div>
  </form>

  <section>
    <p class="label mb-3">Accuracy by time of day (local)</p>
    {#if data.trends.byHour.length === 0}
      <p class="panel p-5 text-sm text-muted">No hour has enough attempts to display yet.</p>
    {:else}
      <div class="panel p-5">
        <div class="flex items-end gap-1" style="height: 110px">
          {#each data.trends.byHour as h}
            <div class="flex flex-1 flex-col items-center justify-end gap-1">
              <div class="w-full bg-accent/50" style="height: {(h.accuracy / maxH) * 100}%" title="{h.hour}:00 - {h.accuracy}% (n={h.n})"></div>
              <span class="text-[8px] text-muted">{h.hour}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <section>
    <p class="label mb-3">By day of week</p>
    {#if data.trends.byDow.length === 0}
      <p class="panel p-5 text-sm text-muted">Not enough data per weekday yet.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.trends.byDow as d}
          <div class="flex items-center gap-4 px-4 py-2 text-sm">
            <span class="w-10 font-mono">{DOW[d.dow]}</span>
            <div class="h-2 flex-1 bg-edge"><div class="h-2 bg-accent/60" style="width: {(d.accuracy / maxD) * 100}%"></div></div>
            <span class="w-24 text-right font-mono text-muted">{d.accuracy}% · n={d.n}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <p class="label mb-3">By month (seasonality)</p>
    {#if data.trends.byMonth.length === 0}
      <p class="panel p-5 text-sm text-muted">Seasonal trends appear once data spans enough of the year.</p>
    {:else}
      <div class="panel divide-y divide-edge">
        {#each data.trends.byMonth as m}
          <div class="flex items-center gap-4 px-4 py-2 text-sm">
            <span class="w-10 font-mono">{MON[m.month - 1]}</span>
            <div class="h-2 flex-1 bg-edge"><div class="h-2 bg-accent/60" style="width: {(m.accuracy / maxM) * 100}%"></div></div>
            <span class="w-24 text-right font-mono text-muted">{m.accuracy}% · n={m.n}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
