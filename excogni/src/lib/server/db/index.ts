import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Two deliberately separate clients:
//   - Drizzle owns its own postgres.js instance (it overrides the client's
//     type parsers/serializers for its column mapping)
//   - raw `pg` keeps a pristine instance so timestamps come back as Date
//     and helpers like pg.json() behave normally
// Sharing one client between the two corrupts raw-query type handling.
//
// Both are lazy: SvelteKit's post-build analyse step imports server chunks
// with no runtime env, so nothing here may connect or throw at module scope.

function makeClient(): ReturnType<typeof postgres> {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  // Explicit, spike-safe pool. Two clients exist (raw + Drizzle), so total connections =
  // 2 * max. Keep well under Postgres's default max_connections (100): 10 each = 20 total,
  // leaving ample headroom for migrations, psql, backups. idle_timeout reaps idle conns so a
  // traffic burst that opens many doesn't hold them; connect_timeout fails fast rather than
  // hanging a request if the DB is momentarily saturated. Override via env if ever needed.
  const max = Number(env.DB_POOL_MAX || 10);
  return postgres(url, {
    onnotice: () => {},
    max,
    idle_timeout: 20,      // seconds an idle connection is kept before being closed
    connect_timeout: 10    // seconds to wait for a new connection before erroring
  });
}

let _pgRaw: ReturnType<typeof postgres> | null = null;
let _pgDrizzle: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

const rawClient = () => (_pgRaw ??= makeClient());

// pg is used both as a template tag (pg`...`) and for helpers (pg.json(...)),
// so the proxy forwards both calls and property access.
export const pg = new Proxy(function () {} as unknown as ReturnType<typeof postgres>, {
  apply: (_t, _this, args) => (rawClient() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = rawClient() as unknown as Record<PropertyKey, unknown>;
    const v = c[prop];
    // bind helpers like pg.json so they keep their `this` (postgres.js relies on it)
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  }
}) as ReturnType<typeof postgres>;

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (_t, prop) => {
    if (!_db) {
      _pgDrizzle = makeClient();
      _db = drizzle(_pgDrizzle, { schema });
    }
    return (_db as unknown as Record<PropertyKey, unknown>)[prop];
  }
}) as ReturnType<typeof drizzle>;
