<script lang="ts">
  export let data;

  // Minimal formatter for our own trusted file: escape first, then re-introduce the three
  // constructs the changelog actually uses (**bold**, `code`, and "- " bullets).
  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s: string): string {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-body font-normal">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.85em] text-accent">$1</code>');
  }
  function render(body: string): string {
    // group lines into paragraphs and bullet items (bullets wrap with 2-space indents)
    const blocks: { kind: 'p' | 'li'; text: string }[] = [];
    for (const raw of body.split('\n')) {
      const line = raw.trimEnd();
      if (!line.trim()) continue;
      if (/^- /.test(line)) blocks.push({ kind: 'li', text: line.slice(2) });
      else if (blocks.length && /^\s{2,}/.test(raw)) blocks[blocks.length - 1].text += ' ' + line.trim();
      else blocks.push({ kind: 'p', text: line.trim() });
    }
    const out: string[] = [];
    let inList = false;
    for (const b of blocks) {
      if (b.kind === 'li' && !inList) { out.push('<ul class="flex flex-col gap-1.5 pl-4" style="list-style: disc">'); inList = true; }
      if (b.kind === 'p' && inList) { out.push('</ul>'); inList = false; }
      out.push(b.kind === 'li' ? `<li>${inline(b.text)}</li>` : `<p>${inline(b.text)}</p>`);
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  }
</script>

<svelte:head>
  <title>Changelog - Excogni</title>
  <meta name="description" content="Every release, including the mistakes - the full public changelog." />
</svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-8 py-8">
  <div class="flex flex-col gap-2">
    <p class="label text-accent">Changelog</p>
    <h1 class="text-2xl font-light">Every release, including the mistakes.</h1>
    <p class="text-sm leading-relaxed text-muted">
      This is the project's actual changelog - the same file that ships in the repository,
      not a marketing digest. Fixed security issues are disclosed here after the fix; if an
      incident ever requires notifying you, this page and an in-app notice are the channel.
    </p>
  </div>

  {#each data.entries as e (e.version)}
    <article class="flex flex-col gap-2 border-t border-edge pt-5">
      <div class="flex flex-wrap items-baseline gap-3">
        <span class="font-mono text-sm text-accent">{e.version}</span>
        <h2 class="text-base text-body">{e.title}</h2>
      </div>
      <div class="flex flex-col gap-2 text-sm leading-relaxed text-muted">
        {@html render(e.body)}
      </div>
    </article>
  {/each}

  {#if !data.showingAll}
    <a href="/changelog?all=1" class="label text-accent hover:underline">
      Show all {data.total} releases →
    </a>
  {/if}
</div>
