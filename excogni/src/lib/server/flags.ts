import { env } from '$env/dynamic/private';

const isTrue = (v: string | undefined) => (v || '').toLowerCase() === 'true';

// Runtime overrides snapshot, kept in-memory and refreshed by the runtime-flags layer (which reads
// the app_flags table). Sync flag reads consult this first so an admin toggle takes effect without a
// redeploy, while existing synchronous callers keep working unchanged. null = no override.
const overrideSnapshot: Record<string, boolean | undefined> = {};
export function setFlagOverrideSnapshot(snap: Record<string, boolean | undefined>): void {
  for (const k of Object.keys(snap)) overrideSnapshot[k] = snap[k];
}
const resolved = (key: string, envVal: boolean): boolean =>
  overrideSnapshot[key] === undefined ? envVal : (overrideSnapshot[key] as boolean);

export const flags = {
  // dev/test seeding + dev login form. NEVER true in production.
  // simulated reference population; included in pools only while this is true.
  simulatedUsers: () => resolved('simulatedUsers', isTrue(env.ENABLE_SIMULATED_USERS)),
  // renders magic links on the login page (no SMTP needed in dev).
  // Dev-only: the login page shows the magic link inline. HARD-disabled in production -
  // exposing the link means anyone can log in as any email address, so no flag may turn
  // this on when NODE_ENV=production, even by accident.
  exposeMagicLinks: () => process.env.NODE_ENV !== 'production' && isTrue(env.DEV_EXPOSE_MAGIC_LINKS),
  // gates all debug surfaces: raw scores, pool internals, simulated-pool notes, IDs.
  showDebugUi: () => isTrue(env.SHOW_DEBUG_UI),
  // when true, the public /statistics page includes simulated users (clearly labeled as
  // a preview) so the page can be demoed before real consented users exist. NEVER true in
  // production - it would show synthetic data alongside real. Off by default.
  statsPreview: () => resolved('statsPreview', isTrue(env.STATS_PREVIEW)),
  // Practice circles (the social feature). Off by default - opt in with ENABLE_CIRCLES=true.
  // Lets the whole feature be shipped dark and switched on/off without a code change.
  circlesEnabled: () => resolved('circles', isTrue(env.ENABLE_CIRCLES)),
  // UI languages beyond English (hr/de) - OFF until translation coverage is complete
  langsEnabled: () => resolved('langs', isTrue(env.ENABLE_LANGS))
};

// Admin statistical tool - standalone, env-token gated. Empty token = disabled.
export const adminConfig = {
  token: () => (env.ADMIN_TOKEN || '').trim(),
  enabled: () => (env.ADMIN_TOKEN || '').trim().length >= 16,
  minCell: () => {
    const n = parseInt(env.ADMIN_MIN_CELL || '20', 10);
    return Number.isFinite(n) && n >= 5 ? n : 20;
  },
  // Public breakdowns are openly filterable and exportable, so a more conservative floor
  // than the admin one: any filtered group below this is withheld. Never below the admin
  // floor; defaults to 50.
  publicMinCell: () => {
    const n = parseInt(env.PUBLIC_MIN_CELL || '50', 10);
    const adminFloor = parseInt(env.ADMIN_MIN_CELL || '20', 10);
    const safeAdmin = Number.isFinite(adminFloor) && adminFloor >= 5 ? adminFloor : 20;
    return Number.isFinite(n) && n >= safeAdmin ? n : 50;
  }
};

// Minimum number of pool-eligible rated users before percentiles are shown at all.
// Below this the product displays an honest "calibrating" state instead of a number.
export const MIN_POOL_FOR_PERCENTILE = 20;
