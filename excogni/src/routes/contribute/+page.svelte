<script lang="ts">
  let proposalType: 'paradigm' | 'scoring' | 'validity' | 'other' = 'paradigm';
  let name = '';
  let contact = '';
  let message = '';
  let sending = false;
  let sent = false;
  let error = '';

  async function submit() {
    if (!message.trim()) { error = 'Please describe your proposal.'; return; }
    sending = true; error = '';
    const composed =
      `[methodology proposal: ${proposalType}]\n` +
      (name ? `from: ${name}\n` : '') +
      (contact ? `contact: ${contact}\n` : '') +
      `\n${message.trim()}`;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'methodology', message: composed, route: '/contribute' })
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); error = j.error || 'Could not send.'; }
      else sent = true;
    } catch { error = 'Network error - please try again.'; }
    sending = false;
  }
</script>

<svelte:head><title>Contribute methodologically - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-2xl flex-col gap-6 py-6 sm:gap-8 sm:py-8">
  <div class="flex flex-col gap-3">
    <p class="label text-accent">Contribute methodologically</p>
    <h1 class="text-2xl font-light">Propose a paradigm, a scoring method, or a validity check.</h1>
    <p class="text-sm leading-relaxed text-muted">
      Excogni's credibility rests on open, reviewable methods. If you're a researcher or practitioner
      with a cognitive paradigm worth measuring, a better scoring approach, or a way to validate the
      instrument, propose it here. Accepted proposals enter as <span class="text-accent">experimental</span> -
      collecting data on real users without affecting official scores - and graduate into the canonical
      methodology (with a version bump and your name in the changelog) once reviewed for reliability,
      discrimination, and construct validity.
    </p>
  </div>

  {#if sent}
    <div class="panel flex flex-col gap-2 border-l-2 border-l-ok p-6">
      <p class="text-body">Thank you - your proposal is in.</p>
      <p class="text-sm text-muted">If it leads to a methodology change, it'll be recorded on the <a href="/methodology" class="text-accent hover:underline">methodology page</a> and credited on <a href="/contributions" class="text-accent hover:underline">contributions</a>.</p>
    </div>
  {:else}
    <div class="panel flex flex-col gap-4 p-6">
      <div class="flex flex-col gap-2">
        <p class="label">What are you proposing?</p>
        <div class="flex flex-wrap gap-2">
          {#each [['paradigm','A new paradigm / challenge type'],['scoring','A scoring method'],['validity','A validation method'],['other','Something else']] as [val, lbl]}
            <button type="button"
              class="rounded border px-3 py-1 text-xs transition-colors {proposalType === val ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-muted hover:text-body'}"
              on:click={() => (proposalType = val)}>{lbl}</button>
          {/each}
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-xs text-muted">Your name (optional, for credit)
          <input bind:value={name} class="field text-sm" placeholder="Name or handle" maxlength="80" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">Contact (optional)
          <input bind:value={contact} class="field text-sm" placeholder="email, ORCID, site…" maxlength="120" />
        </label>
      </div>

      <label class="flex flex-col gap-1 text-xs text-muted">Your proposal
        <textarea bind:value={message} rows="8" class="field text-sm"
          placeholder="Describe the paradigm/method, what cognitive construct it targets, how it would be scored, and any evidence for its reliability or validity. Links to papers welcome."></textarea>
      </label>

      {#if error}<p class="text-sm text-bad">{error}</p>{/if}
      <button class="btn-primary self-start text-sm" disabled={sending} on:click={submit}>{sending ? 'Sending…' : 'Submit proposal'}</button>
      <p class="text-xs text-muted">Proposals are reviewed manually. There's no obligation to adopt any submission, and adoption follows validation - this keeps the canonical battery trustworthy.</p>
    </div>
  {/if}
</div>
