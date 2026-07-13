<script lang="ts">
  export let data;
  const c = data.category;
  const practiceHref = c.slug === 'retention' ? '/practice/retention'
    : c.slug === 'reaction_time' ? '/practice/reaction'
    : `/practice/run?category=${c.slug}`;
</script>

<svelte:head><title>{c.name} - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 py-8">
  <a href="/stats" class="label text-muted hover:text-body">← Dashboard</a>
  <div class="flex flex-col gap-2">
    <p class="label text-accent">{data.domainLabel}</p>
    <h1 class="text-3xl font-light">{c.name}</h1>
    <p class="text-muted">{c.description}</p>
  </div>
  {#if c.about}
    <p class="text-lg leading-relaxed">{c.about}</p>
  {/if}
  <div class="flex gap-3">
    <a href={practiceHref} class="btn-primary">Practice {c.name}</a>
    <a href="/stats?cat={c.slug}" class="btn">See my stats</a>
  </div>
</div>
