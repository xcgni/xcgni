# Excogni mobile (Capacitor) - architecture & runbook

## The core fact that shapes everything

Excogni is an **SSR app** (21 server routes, Postgres, auth, scoring on the server). It is
**not** a static site, so you cannot bundle the whole app offline into the phone - the
server logic must stay on your server.

That rules out the naive Capacitor flow ("build static site → copy into app → ship"). The
correct pattern for an SSR app is:

### Chosen pattern: native shell → your hosted server

The Capacitor app is a **thin native wrapper** whose webview loads your deployed Excogni
server (e.g. https://excogni.com). The phone gets a real app-store binary, native push
notifications, native splash/icon, and offline-aware behaviour - but the actual app is your
existing SSR site, served from your backend. One codebase, one backend, web and mobile
identical and always in sync.

- **Pro:** zero code duplication; web and mobile can never drift; ship web fixes instantly
  without an app-store update; your existing auth/session/scoring all just work.
- **Con:** requires network (fine - Excogni is inherently online: it needs the DB to score);
  Apple sometimes scrutinises "just a website" wrappers, so we add native capabilities
  (push, status bar, haptics, share) to make it a legitimate app, not a bare webview.

(The alternative - split into a static SvelteKit SPA front-end + separate API, bundled
offline - is a much larger rewrite and unnecessary. Not chosen.)

## What's been scaffolded into the repo

- `capacitor.config.ts` - Capacitor config (app id, name, server URL, splash, etc.)
- `package.json` - Capacitor deps + mobile scripts added (devDependencies; install on your machine)
- `mobile/` - notes and the native-capability bridge (push, status bar, haptics)
- `static/` icon/splash source notes

## Runbook (on YOUR machine - needs network + Android Studio / Xcode)

```bash
# 0. one-time: install the deps that were added to package.json
npm install

# 1. set your deployed server URL in capacitor.config.ts (server.url)
# - for local testing against your dev box use your LAN IP, e.g. http://192.168.1.20:3000

# 2. add native platforms (creates android/ and ios/ projects)
npx cap add android
npx cap add ios        # macOS + Xcode only

# 3. sync config + plugins into the native projects
npx cap sync

# 4. open in the native IDE and run on a device/emulator
npx cap open android   # Android Studio → Run
npx cap open ios       # Xcode → Run

# iteration after changing capacitor.config.ts or plugins:
npx cap sync
```

Because the app loads your live server, you do **not** rebuild/redeploy the app for web
content changes - only for native shell changes (icon, plugins, config). That's the big win.

## App store tax (the real ongoing cost)

- Apple Developer Program: $99/year. Google Play: one-time $25.
- Review cycles (Apple can reject/delay). Keep the app a *legitimate* app (push, native
  features) not a bare webview, to pass review.
- You control web content server-side, so most updates skip the stores entirely.

## Native capabilities to add (make it a real app, not a webview)

- **Push notifications** - the "serving, not compelling" kind: "your weekly recap is ready",
  "you usually check in around now". Plugin: @capacitor/push-notifications (+ a server
  endpoint to register device tokens - a future backend task, noted in ROADMAP).
- **Status bar / splash** - @capacitor/status-bar, @capacitor/splash-screen (dark theme to
  match the ink aesthetic).
- **Haptics** - @capacitor/haptics, a subtle tap on correct/incorrect (optional, on-brand if
  restrained).
- **Share** - @capacitor/share, for the profile PNG export.

## Known follow-ups (not solvable in this scaffold)

- Device push-token registration endpoint on the backend (new API route + table).
- App icon + splash image assets (design task; place in resources/ and run capacitor-assets).
- Apple "minimum functionality" review risk - mitigated by real native features above.
- Deep links / universal links if you want excogni.com URLs to open the app.

## Multiple apps from one backend (variants)

You can ship several apps (serious / playful / kids) that all use the SAME backend. They
differ only in identity, theme, and which features are on - defined in one place:
`variants.config.ts`.

### Build a specific variant

```bash
# generate capacitor.config.ts for a variant:
node scripts/make-variant.mjs serious     # Excogni (default)
node scripts/make-variant.mjs playful     # Mind Gym
node scripts/make-variant.mjs kids        # Brain Quest (conservative defaults)

# then the normal flow (first time per variant, in its own working copy):
npx cap add android      # or ios
npx cap sync
npx cap open android
```

Because each variant has a different `appId`, the stores treat them as separate apps. The
recommended workflow for maintaining several: keep one git checkout per variant (or a
branch), generate that variant's config in it, and build. The shared code/backend stays
identical; only `capacitor.config.ts` and the icons differ.

### How variants skin the SAME web app

Each variant loads `https://excogni.com?variant=<key>`. The server reads that param
(`src/routes/+layout.server.ts`), stores it in a cookie, and exposes it as
`data-variant="<key>"` on the layout root. To theme a variant, add CSS scoped to
`[data-variant="playful"]` / `[data-variant="kids"]` - no separate front-end needed.

### Adding a NEW variant

1. Add an entry to `VARIANTS` in `variants.config.ts` (unique `appId`!).
2. `node scripts/make-variant.mjs <yourkey>`.
3. Build as above.

### Kids variant - READ THIS

The `kids` variant turns off the questionnaire, consent prompts, account, and public stats
by default. That is a starting posture, NOT compliance. Before shipping anything aimed at
children you need a deliberate review: COPPA (US) / GDPR-K (EU), no data collection from
minors, no open social features, parental-consent flows, and app-store kids-category rules.
Treat the kids app as its own project with its own legal/safety pass.
