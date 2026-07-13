<script lang="ts">
  export let data;
  export let form;
</script>

<svelte:head><title>Log in - Excogni</title></svelte:head>

<div class="mx-auto flex max-w-md flex-col gap-8 pt-8">
  <div>
    <p class="label mb-2">Log in or register</p>
    <p class="text-sm text-muted">
      One field for both. If you practiced anonymously in this browser, registering
      keeps everything you have done so far.
    </p>
  </div>

  {#if data.expired}
    <div class="panel border-bad/40 p-3 text-sm text-muted">That link has expired or was already used. Request a new one below.</div>
  {:else if data.invalid}
    <div class="panel border-bad/40 p-3 text-sm text-muted">That link wasn't valid. Request a new one below.</div>
  {/if}

  <form method="POST" action="?/magic" class="panel flex flex-col gap-3 p-5">
    {#if data.redirectTo}<input type="hidden" name="redirect" value={data.redirectTo} />{/if}
    <label class="label" for="email">Email</label>
    <input id="email" name="email" type="email" required placeholder="you@example.com" class="field" />
    <button type="submit" class="btn-primary">Send magic link</button>

    {#if form?.magicError}<p class="text-sm text-bad">{form.magicError}</p>{/if}
    {#if form?.magicSent}
      <p class="text-sm text-ok">Magic link created for {form.email}.</p>
      {#if form?.devLink}
        <div class="border border-edge bg-ink p-3">
          <p class="label mb-2">Dev mode - link exposed</p>
          <a href={form.devLink} class="break-all font-mono text-xs text-accent hover:underline">{form.devLink}</a>
        </div>
      {:else}
        <p class="text-sm text-muted">Check your inbox. The link is valid for 30 minutes.</p>
      {/if}
    {/if}
  </form>

  <p class="text-xs text-muted">
    Google sign-in is planned; magic links are the only method in this version.
  </p>
</div>
