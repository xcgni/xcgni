import { pg } from '$lib/server/db';
import { flags, setFlagOverrideSnapshot } from '$lib/server/flags';

// The flags an admin can flip live from /admin/toggles. Each has an env default (via flags.*) and an
// optional DB override (app_flags). DB override wins; absent, we fall back to the env default. A short
// cache avoids a query on every request; setRuntimeFlag clears it.

export type RuntimeFlagKey = 'circles' | 'simulatedUsers' | 'statsPreview';

export interface RuntimeFlagDef {
  key: RuntimeFlagKey;
  label: string;
  description: string;
  envDefault: () => boolean;
}

export const RUNTIME_FLAGS: RuntimeFlagDef[] = [
  {
    key: 'simulatedUsers',
    label: 'Simulated reference population',
    description:
      'When ON, population stats (the blue points, distributions, percentiles) include the simulated ' +
      'users so the experience is populated before real data exists. Flip OFF once you have enough ' +
      'real users - every stat then recomputes against real humans only. Real user scores are never ' +
      'affected; only the comparison backdrop changes.',
    envDefault: () => flags.simulatedUsers()
  },
  {
    key: 'circles',
    label: 'Practice circles (Social / Experimental)',
    description:
      'The opt-in social feature - shared-code circles, circle radar, head-to-head. Off by default; ' +
      'it is the one feature that leans against the "measured, not gamified" posture.',
    envDefault: () => flags.circlesEnabled()
  },
  {
    key: 'statsPreview',
    label: 'Public stats preview mode',
    description:
      'When ON, the public /statistics page includes simulated users (clearly labelled) so it can be ' +
      'demoed before real consented users exist.',
    envDefault: () => flags.statsPreview()
  }
];

// tiny cache: { key -> boolean | null(no override) }, refreshed every CACHE_MS
let cache: Map<string, boolean> | null = null;
let cacheAt = 0;
const CACHE_MS = 5000;

async function loadOverrides(): Promise<Map<string, boolean>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;
  const rows = await pg`SELECT key, value FROM app_flags`;
  cache = new Map((rows as { key: string; value: boolean }[]).map((r) => [r.key, r.value]));
  cacheAt = now;
  // push into the sync-readable snapshot so flags.* (sync callers) honor overrides too.
  // keys with no row are set to undefined (= use env default).
  const snap: Record<string, boolean | undefined> = {};
  for (const f of RUNTIME_FLAGS) snap[f.key] = cache.has(f.key) ? cache.get(f.key) : undefined;
  setFlagOverrideSnapshot(snap);
  return cache;
}

function clearCache() { cache = null; cacheAt = 0; }

// resolve one flag: DB override if present, else env default
export async function flagOn(key: RuntimeFlagKey): Promise<boolean> {
  const def = RUNTIME_FLAGS.find((f) => f.key === key);
  if (!def) return false;
  const overrides = await loadOverrides();
  if (overrides.has(key)) return overrides.get(key)!;
  return def.envDefault();
}

// the full resolved state, for the admin page + nav gating
export async function resolveAllFlags(): Promise<{ key: RuntimeFlagKey; label: string; description: string; on: boolean; source: 'override' | 'env' }[]> {
  const overrides = await loadOverrides();
  return RUNTIME_FLAGS.map((f) => ({
    key: f.key,
    label: f.label,
    description: f.description,
    on: overrides.has(f.key) ? overrides.get(f.key)! : f.envDefault(),
    source: overrides.has(f.key) ? 'override' : 'env'
  }));
}

export async function setRuntimeFlag(key: RuntimeFlagKey, value: boolean, who: string): Promise<void> {
  if (!RUNTIME_FLAGS.some((f) => f.key === key)) throw new Error('unknown flag');
  await pg`
    INSERT INTO app_flags (key, value, updated_at, updated_by)
    VALUES (${key}, ${value}, now(), ${who})
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now(), updated_by = ${who}
  `;
  clearCache();
}

// reset a flag to its env default (delete the override)
export async function clearRuntimeFlag(key: RuntimeFlagKey): Promise<void> {
  await pg`DELETE FROM app_flags WHERE key = ${key}`;
  clearCache();
}
