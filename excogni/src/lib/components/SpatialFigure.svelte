<script lang="ts">
  // Renders a spatial figure (list of filled grid cells with one accent cell)
  // as a clean SVG glyph. Used for both the prompt figure and option tiles.
  export let cells: number[][] = [];
  export let accentIdx = 0;
  export let grid = 4;
  export let size = 96;
  export let showAxis = false;
  export let selected = false;
  export let dim = false;

  const pad = 8;
  $: cell = (size - pad * 2) / grid;
  // center the figure within the grid box
  $: maxX = cells.length ? Math.max(...cells.map((c) => c[0])) : 0;
  $: maxY = cells.length ? Math.max(...cells.map((c) => c[1])) : 0;
  $: offX = (grid - 1 - maxX) / 2;
  $: offY = (grid - 1 - maxY) / 2;
</script>

<svg
  viewBox="0 0 {size} {size}"
  class="block {dim ? 'opacity-40' : ''}"
  width={size}
  height={size}
  role="img"
>
  {#if showAxis}
    <line
      x1={size / 2} y1={pad / 2} x2={size / 2} y2={size - pad / 2}
      stroke="rgb(var(--c-accent))" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"
    />
  {/if}
  {#each cells as c, i}
    <rect
      x={pad + (c[0] + offX) * cell + 1}
      y={pad + (c[1] + offY) * cell + 1}
      width={cell - 2}
      height={cell - 2}
      rx="2"
      fill={i === accentIdx ? 'rgb(var(--c-accent))' : (selected ? '#3A4150' : '#2A313D')}
      stroke={i === accentIdx ? 'rgb(var(--c-accent))' : '#3A4150'}
      stroke-width="1"
    />
  {/each}
</svg>
