<script lang="ts">
  // The form is deliberately identical whether or not TOTP is configured - the page
  // discloses nothing about the deployment's auth posture. The server ignores the code
  // field when TOTP is off.
  export let form;
</script>

<svelte:head>
  <title>Admin login - Excogni</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex max-w-sm flex-col gap-6 py-16">
  <div class="flex flex-col gap-1">
    <p class="label text-accent">Admin</p>
    <h1 class="text-2xl font-light">Sign in</h1>
  </div>

  <form method="POST" class="panel flex flex-col gap-4 p-5">
    <label class="flex flex-col gap-1.5">
      <span class="label">Admin token</span>
      <input
        name="token"
        type="password"
        autocomplete="off"
        required
        class="rounded border border-edge bg-ink px-3 py-2 font-mono text-sm"
      />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="label">Authenticator code</span>
      <input
        name="code"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="8"
        autocomplete="one-time-code"
        placeholder="123456"
        class="rounded border border-edge bg-ink px-3 py-2 font-mono text-sm tracking-widest"
      />
    </label>

    {#if form?.error}
      <p class="text-sm text-red-400">{form.error}</p>
    {/if}

    <button type="submit" class="btn-primary">Sign in</button>
  </form>
</div>
