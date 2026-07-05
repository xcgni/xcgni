<script lang="ts">
  export let data;
  // only show groups that have people, plus always show the closing CTA
  $: populated = data.groups.filter((g) => g.people && g.people.length > 0);
  $: anyPeople = populated.length > 0;
</script>

<svelte:head><title>Contributions - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-8 py-8">
  <div class="flex flex-col gap-3">
    <p class="label text-accent">Contributions</p>
    <h1 class="text-2xl font-light">The people building a trustworthy instrument.</h1>
    <p class="text-sm leading-relaxed text-muted">
      Excogni is meant to be a commons. The credibility of a cognition score doesn't come from a
      company - it comes from open methods, honest validation, and the people who test, question, and
      refine them. This page records that work.
    </p>
  </div>

  {#if anyPeople}
    {#each populated as group}
      <section class="flex flex-col gap-3">
        <div>
          <p class="label">{group.title}</p>
          <p class="text-xs text-muted">{group.blurb}</p>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {#each group.people as p}
            <div class="panel flex flex-col gap-1 p-4">
              <span class="text-body">{p.name}</span>
              {#if p.note}<span class="text-xs text-muted">{p.note}</span>{/if}
              {#if p.link}<a href={p.link} class="text-xs text-accent hover:underline" rel="noopener" target="_blank">{p.link.replace(/^https?:\/\//, '')}</a>{/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {:else}
    <!-- honest empty state -->
    <section class="panel flex flex-col gap-3 border-l-2 border-l-edge p-6">
      <p class="text-sm leading-relaxed text-body">
        No names here yet - the project is early. As people test builds, contribute methods, validate
        the instrument, or support the work, they'll be acknowledged here by name (with their consent).
      </p>
      <p class="text-xs text-muted">
        The categories we'll recognise: methodology contributors, research &amp; validation, testers,
        supporters, and code contributors.
      </p>
    </section>
  {/if}

  <section class="panel flex flex-col gap-3 p-6">
    <p class="label">Want to be part of it?</p>
    <p class="text-sm leading-relaxed text-muted">
      Whether you can propose a paradigm, help validate the instrument, test a build, or support the
      work - there's a place for you here.
    </p>
    <div class="flex flex-wrap gap-2">
      <a href="/contribute" class="btn-primary text-sm">Contribute methodologically</a>
      <a href="/methodology" class="btn text-sm">See the methodology</a>
    </div>
  </section>
</div>
