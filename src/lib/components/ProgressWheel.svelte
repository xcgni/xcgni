<script lang="ts">
  // An honest completeness ring. The fill is real progress toward valid measurements (calibrated
  // domains + sessions toward insights), not an arbitrary number. Calm, instrument-like.
  export let readiness: {
    overallPct: number;
    sessions: { have: number; need: number };
    calibratedDomains: { have: number; total: number };
    insightsReady: boolean;
    message: string;
  };
  export let size = 132;
  // Whether to render the readiness.message inside the wheel block. Set false where the surrounding
  // page already shows the message, to avoid printing the same sentence twice side by side.
  export let showMessage = true;

  $: pct = Math.max(0, Math.min(100, readiness.overallPct));
  $: r = size / 2 - 10;
  $: circ = 2 * Math.PI * r;
  $: dash = (pct / 100) * circ;
  $: color = pct >= 100 ? 'rgb(var(--c-ok))' : 'rgb(var(--c-accent))';
</script>

<div class="flex items-center gap-5">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0 -rotate-90">
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#202733" stroke-width="8" />
    <circle
      cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width="8"
      stroke-linecap="round" stroke-dasharray="{dash} {circ}"
      style="transition: stroke-dasharray .6s ease"
    />
    <text x={size / 2} y={size / 2} text-anchor="middle" dominant-baseline="central"
      class="rotate-90" style="transform-box: fill-box; transform-origin: center"
      fill="#E8EAED" font-size="22" font-family="ui-monospace, monospace">{pct}%</text>
  </svg>

  <div class="flex flex-col gap-2">
    {#if showMessage}
      <p class="text-sm text-body">{readiness.message}</p>
    {/if}
    <div class="flex flex-col gap-1 text-xs text-muted">
      <span>
        <span class="font-mono text-accent">{readiness.calibratedDomains.have}/{readiness.calibratedDomains.total}</span>
        areas measured {readiness.calibratedDomains.have >= readiness.calibratedDomains.total ? '· profile complete' : '· toward a complete profile'}
      </span>
      <span>
        <span class="font-mono {readiness.sessions.have > 0 ? 'text-body' : 'text-muted'}">{readiness.sessions.have}</span>
        practice day{readiness.sessions.have === 1 ? '' : 's'} logged · patterns appear as your data builds
      </span>
    </div>
  </div>
</div>
