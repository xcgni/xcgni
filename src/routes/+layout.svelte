<script lang="ts">
  // Fonts, self-hosted through the build (fontsource): no Google/third-party requests at runtime,
  // consistent with the no-trackers privacy posture. Instrument Sans for UI, IBM Plex Mono for
  // numerals/labels (terminal heritage - numbers should read like an instrument).
  import '@fontsource-variable/instrument-sans';
  import '@fontsource/ibm-plex-mono/400.css';
  import '@fontsource/ibm-plex-mono/500.css';
  import '../app.css';
  import { page } from '$app/stores';
  import { navigating } from '$app/stores';
  import { fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import FeedbackWidget from '$lib/components/FeedbackWidget.svelte';
  import CookieNotice from '$lib/components/CookieNotice.svelte';
  export let data;

  // Native shell init: hide the splash once interactive, wire the Android back button, and mirror
  // the server's notification plan into the OS scheduler. All of it no-ops on the plain web.
  onMount(async () => {
    const { hideSplash, registerBackButton, syncNotificationSchedule, isNative } = await import('$lib/native');
    await hideSplash();
    await registerBackButton();
    if (await isNative()) {
      try {
        const res = await fetch('/api/notify/plan');
        if (res.ok) await syncNotificationSchedule(await res.json());
      } catch { /* offline app open - the previously scheduled notifications stay */ }
    }
  });

  // Apply the selected theme at the document root so the body background and the whole document
  // pick it up (the CSS variables for the palette live on [data-variant]). 'serious' = no attribute,
  // falling back to the :root default.
  $: if (typeof document !== 'undefined') {
    if (data.variant && data.variant !== 'serious') {
      document.documentElement.setAttribute('data-variant', data.variant);
    } else {
      document.documentElement.removeAttribute('data-variant');
    }
  }

  // Primary nav stays minimal; everything else lives under Account.
  $: primary = [
    { href: '/practice', label: 'Practice' },
    { href: '/stats', label: 'Stats' },
    ...(data.circlesEnabled ? [{ href: '/circles', label: 'Experimental' }] : [])
  ];
  const accountLinks = [
    { href: '/review', label: 'Review' },
    { href: '/settings', label: 'Settings' }
  ];

  let menuOpen = false;
  let menuRoot: HTMLElement;
  $: path = $page.url.pathname;
  $: registered = data.user && !data.user.isAnonymous;
  $: identity = registered ? (data.user.username ?? data.user.emailHint ?? 'Account') : 'Account';

  // Two closers: item clicks close unconditionally; window clicks close only when the
  // click lands OUTSIDE the menu (containment check - keeps everything a11y-clean, no
  // stopPropagation wrappers needed).
  function closeMenu() {
    menuOpen = false;
  }
  function closeMenuOnOutside(e: MouseEvent) {
    if (menuOpen && menuRoot && !menuRoot.contains(e.target as Node)) menuOpen = false;
  }
</script>

<svelte:head>
  <!-- Crawler-facing identity: this is what wins brand-name queries (DDG/Bing especially).
       Pages own their <title>; the layout owns the shared metadata. -->
  <meta name="description" content="Excogni is a gym for the mind: adaptive challenges that train and measure at the same time. Honest, calibrated cognitive ratings across 17 domains - no gimmicks, no dark patterns, free and open." />
  <link rel="canonical" href={"https://xcgni.com" + $page.url.pathname} />
  <meta property="og:site_name" content="Excogni" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Excogni - honest cognitive fitness" />
  <meta property="og:description" content="A gym for the mind: adaptive challenges that train and measure at the same time. Honest, calibrated ratings - free and open." />
  <meta property="og:url" content={"https://xcgni.com" + $page.url.pathname} />
  <meta property="og:image" content="https://xcgni.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<svelte:window on:click={closeMenuOnOutside} />

{#if $navigating}
  <div class="fixed left-0 top-0 z-[60] h-0.5 w-full overflow-hidden bg-transparent">
    <div class="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite]" style="background:linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.5) 60%, rgb(var(--c-accent)))"></div>
  </div>
{/if}

<div class="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
  <header class="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-edge bg-ink/95 py-4 backdrop-blur-md">
    <!-- home for a signed-in user is the welcome page (the / landing redirects them to practice, which made welcome unreachable from the wordmark) -->
    <a href={registered ? '/welcome' : '/'} class="shrink-0 font-mono text-sm tracking-[0.15em] text-body hover:text-accent sm:text-base sm:tracking-[0.25em]">EXCOGNI</a>

    <nav class="flex items-center gap-0 text-sm sm:gap-1">
      {#each primary as item}
        <a
          href={item.href}
          class="px-2 py-1.5 transition-colors sm:px-3 {path === item.href || path.startsWith(item.href + '/')
            ? 'text-accent'
            : 'text-muted hover:text-body'}"
        >
          {item.label}
        </a>
      {/each}

      {#if data.user}
        <div class="relative ml-1" bind:this={menuRoot}>
          <button
            class="flex items-center gap-1 px-2 py-1.5 text-muted transition-colors hover:text-body sm:gap-1.5 sm:px-3"
            on:click={() => (menuOpen = !menuOpen)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <!-- full generated usernames must be visible (they are the identity now) -->
            <span class="whitespace-nowrap" title="Your generated username - it exists so no page ever shows your email as identity. Settings has the details.">{identity}</span>
            <svg viewBox="0 0 10 6" class="h-1.5 w-2.5 fill-none stroke-current" stroke-width="1.5">
              <path d="M1 1l4 4 4-4" />
            </svg>
          </button>
          {#if menuOpen}
            <div
              class="absolute right-0 z-20 mt-1 w-48 border border-edge bg-surface py-1 shadow-xl"
              role="menu"
              tabindex="-1"
            >
              {#if !registered}
                <div class="border-b border-edge px-3 py-2">
                  <p class="label">Anonymous</p>
                  <a href="/auth/login" class="mt-1 block text-sm text-accent hover:underline">Log in / register</a>
                </div>
              {/if}
              {#each accountLinks as item}
                <a href={item.href} class="block px-3 py-2 text-sm text-muted hover:bg-edge/40 hover:text-body" on:click={closeMenu}>
                  {item.label}
                </a>
              {/each}
              {#if registered}
                <div class="my-1 border-t border-edge"></div>
                <a href="/auth/logout" class="block px-3 py-2 text-sm text-muted hover:bg-edge/40 hover:text-body">Log out</a>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <a href="/auth/login" class="ml-1 px-3 py-1.5 text-muted transition-colors hover:text-body">Log in</a>
      {/if}
    </nav>
  </header>

  <main class="flex-1 py-8 pb-20 sm:pb-8">
    {#key $page.url.pathname}
      <div in:fade={{ duration: 120 }}>
        <slot />
      </div>
    {/key}
  </main>

  <footer class="flex flex-col items-center gap-2 border-t border-edge py-5 text-center">
    <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
      <a href="/about" class="label text-muted hover:text-body">Learn more</a>
      <a href="/statistics" class="label text-muted hover:text-body">Global stats</a>
      <a href="/contributions" class="label text-muted hover:text-body">Contributions</a>
      <a href="/support" class="label text-muted hover:text-body">Support</a>
      <a href="/privacy" class="label text-muted hover:text-body">Privacy</a>
    </nav>
    <p class="label text-muted/70">
      Free &amp; open · anonymous · supported, not sold{#if data.version} · <span class="font-mono">v{data.version}</span>{/if}
    </p>
    <p class="label text-muted/70">
      Built by <a href="https://initsix.dev" class="hover:text-body" rel="noopener" target="_blank">initsix.dev</a>
      · <a href="/changelog" class="hover:text-body">Changelog</a>
      · <a href="https://github.com/xcgni/xcgni" class="hover:text-body" rel="noopener" target="_blank">Source</a>
    </p>
  </footer>
</div>

{#if path !== '/welcome' && !path.startsWith('/auth') && !path.startsWith('/admin')}
  <FeedbackWidget />
{/if}

<CookieNotice />
