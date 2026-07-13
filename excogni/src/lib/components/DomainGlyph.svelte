<script lang="ts">
  // One minimal, geometric, line-based glyph per cognitive domain. Monochrome,
  // uses currentColor and a consistent 1.5 stroke so it sits in the instrument
  // language rather than decorating it. 24x24 viewBox, no fills (line only).
  export let domain: string;
  export let size = 20;

  // each entry is the inner SVG markup (paths drawn with the shared stroke attrs)
  const GLYPHS: Record<string, string> = {
    // interlocking nodes - reasoning as connected structure
    fluid_reasoning: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7.2 15.6 7.2M7.4 8.2 8.4 15.6M10.8 16.8 16.4 9.6"/>',
    // stopwatch - speed under time
    processing_speed: '<circle cx="12" cy="13" r="7"/><path d="M12 13 12 9M12 6 12 4M10 4 14 4"/>',
    // stacked layers - memory as retained strata
    memory: '<path d="M4 8 12 4 20 8 12 12 4 8Z"/><path d="M4 12 12 16 20 12"/><path d="M4 16 12 20 20 16"/>',
    // bar steps - quantitative magnitude
    quantitative: '<path d="M5 19 5 13M11 19 11 8M17 19 17 11"/><path d="M3 19 21 19"/>',
    // speech glyph - verbal
    verbal: '<path d="M4 6 20 6 20 15 12 15 8 19 8 15 4 15Z"/><path d="M8 9 16 9M8 12 13 12"/>',
    // switch/branch - executive control of competing paths
    executive_function: '<path d="M5 7 11 7 13 12 19 12"/><path d="M5 17 11 17 13 12"/><path d="M16 9 19 12 16 15"/>',
    // eye - visual processing
    visual: '<path d="M3 12C6 7 18 7 21 12C18 17 6 17 3 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    // upward arrow from store - retrieval
    retrieval: '<path d="M5 15 5 19 19 19 19 15"/><path d="M12 16 12 5M8 9 12 5 16 9"/>',
    // calendar/repeat - retention over time
    retention: '<rect x="4" y="6" width="16" height="14" rx="1"/><path d="M4 10 20 10M8 4 8 7M16 4 16 7"/><path d="M11 15 13 15"/>',
    // lightning - reaction
    reaction: '<path d="M13 3 6 13 11 13 10 21 18 10 13 10Z"/>',
    other: '<circle cx="12" cy="12" r="8"/><path d="M12 8 12 13M12 16 12 16.2"/>'
  };

  $: inner = GLYPHS[domain] ?? GLYPHS.other;
</script>

<svg
  width={size} height={size} viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width="1.5"
  stroke-linecap="round" stroke-linejoin="round"
  role="img" aria-hidden="true"
>
  {@html inner}
</svg>
