<script lang="ts">
  import { AGE_BANDS } from '$lib/demographics';
  export let data;
  const ci = (s: { mean: number | null; ci95: [number, number] | null; n: number }) =>
    s.mean == null ? 'suppressed' : `${s.mean}${s.ci95 ? ` (95% CI ${s.ci95[0]}-${s.ci95[1]})` : ''} · n=${s.n}`;
</script>

<div class="flex flex-col gap-8">
  <div>
    <p class="label mb-1">Explore</p>
    <p class="text-sm text-muted">Slice the rated population by consented attributes. Every slice respects the {data.minCell}-minimum floor; small cohorts return nothing rather than risk identification.</p>
  </div>

  <form method="GET" class="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
    <label class="flex flex-col gap-1">
      <span class="label">Age band</span>
      <select name="ageBand" class="field">
        <option value="" selected={!data.filters.ageBand}>Any</option>
        {#each AGE_BANDS as b}<option value={b} selected={data.filters.ageBand === b}>{b}</option>{/each}
      </select>
    </label>
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
    <label class="flex flex-col gap-1">
      <span class="label">Education</span>
      <select name="education" class="field">
        <option value="">any</option>
        {#each data.options.education ?? [] as v}<option value={v} selected={data.filters.education === v}>{v}</option>{/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="label">Gender</span>
      <select name="gender" class="field">
        <option value="">any</option>
        {#each data.options.gender ?? [] as v}<option value={v} selected={data.filters.gender === v}>{v}</option>{/each}
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="label">Handedness</span>
      <select name="hand" class="field">
        <option value="">any</option>
        {#each data.options.handedness ?? [] as v}<option value={v} selected={data.filters.handedness === v}>{v}</option>{/each}
      </select>
    </label>
    <div class="flex items-end gap-2">
      <button type="submit" class="btn-primary">Apply</button>
      <a href="/admin/explore" class="btn">Reset</a>
    </div>
  </form>

  <section>
    <p class="label mb-3">Rating distribution {data.active > 0 ? `· ${data.active} filter${data.active === 1 ? '' : 's'} active` : '· whole population'}</p>
    {#if data.distribution.suppressed}
      <p class="panel p-5 text-sm text-muted">This cohort is too small to display ({data.minCell} minimum). Broaden the filters.</p>
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
        <p class="mt-3 font-mono text-xs text-muted">mean {ci(data.distribution.summary)} · median {data.distribution.summary.median}{#if data.distribution.summary.iqr} · IQR {data.distribution.summary.iqr[0]}-{data.distribution.summary.iqr[1]}{/if}</p>
      </div>
    {/if}
  </section>
</div>
