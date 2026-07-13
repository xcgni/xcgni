import type { Cookies } from '@sveltejs/kit';
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { adminConfig } from '$lib/server/flags';
import { pg } from '$lib/server/db';
import { base32Decode, verifyTotp } from './totp';
import { log } from '$lib/server/log';

// Standalone single-admin auth (v0.66.0) - NOT a user role.
//
// Login: POST form at /admin/login with the admin token + a TOTP code (when
// ADMIN_TOTP_SECRET is configured). Success issues a RANDOM bearer session whose
// sha256 is stored server-side (admin_auth table) - the cookie reveals nothing,
// is revocable, and a new login invalidates the previous session (single admin,
// single active session, on purpose).
//
// The old ?key=<token> URL login is GONE: secrets in URLs end up in access logs,
// CDN logs, browser history, and Referer headers.
//
// Replay protection: the last ACCEPTED TOTP counter persists in the DB; a code can
// never be accepted twice, even across restarts or within its +/-30s window.
//
// Brute force: per-IP failure lockout (in-memory; single-instance deployment) plus
// a global circuit breaker. Every failure is one generic message - no oracle about
// WHICH factor was wrong.

const COOKIE = 'excogni_admin';
const TTL_HOURS = 8;
const MAX_FAILS_PER_IP = 5;
const LOCKOUT_MINUTES = 15;
const GLOBAL_MAX_FAILS = 30; // across all IPs per window: stops distributed guessing cold

function sha256hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory; the app runs as a single instance behind Caddy)
// ---------------------------------------------------------------------------
const fails = new Map<string, { n: number; until: number }>();
let globalFails = { n: 0, until: 0 };

function pruneFails(now: number) {
  for (const [k, v] of fails) if (v.until <= now) fails.delete(k);
  if (globalFails.until <= now) globalFails = { n: 0, until: 0 };
}

export function loginLocked(ip: string, now = Date.now()): boolean {
  pruneFails(now);
  const f = fails.get(ip);
  if (f && f.n >= MAX_FAILS_PER_IP && f.until > now) return true;
  if (globalFails.n >= GLOBAL_MAX_FAILS && globalFails.until > now) return true;
  return false;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  pruneFails(now);
  const until = now + LOCKOUT_MINUTES * 60 * 1000;
  const f = fails.get(ip) ?? { n: 0, until };
  fails.set(ip, { n: f.n + 1, until });
  globalFails = { n: globalFails.n + 1, until };
}

export function clearLoginFailures(ip: string): void {
  fails.delete(ip);
}

/** Test hook. */
export function _resetLoginRateLimit(): void {
  fails.clear();
  globalFails = { n: 0, until: 0 };
}

// ---------------------------------------------------------------------------
// TOTP config
// ---------------------------------------------------------------------------
export function totpSecret(): Buffer | null {
  const raw = (process.env.ADMIN_TOTP_SECRET || '').trim();
  if (!raw) return null;
  const buf = base32Decode(raw);
  if (!buf || buf.length < 10) return null; // <80 bits is not a serious secret
  return buf;
}

export function totpEnabled(): boolean {
  return totpSecret() !== null;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export type AdminLoginResult = { ok: true } | { ok: false; reason: 'locked' | 'invalid' };

/**
 * Validates token (+ TOTP code when configured) and, on success, issues the session.
 * One generic 'invalid' for every failure mode: no oracle for which factor failed.
 */
export async function adminLogin(
  token: string,
  code: string,
  ip: string,
  cookies: Cookies
): Promise<AdminLoginResult> {
  if (!adminConfig.enabled()) return { ok: false, reason: 'invalid' };
  if (loginLocked(ip)) return { ok: false, reason: 'locked' };

  let valid = safeEqual(token, adminConfig.token());

  const secret = totpSecret();
  if (secret) {
    // ALWAYS evaluate the TOTP when configured (even if the token already failed),
    // so a failure takes constant work regardless of which factor was wrong.
    const counter = verifyTotp(secret, code);
    if (counter === null) {
      valid = false;
    } else if (valid) {
      // single-use: reject any counter <= the last accepted one (replay, shoulder-surf)
      const claimed = await pg`
        INSERT INTO admin_auth (key, value) VALUES ('totp_last_counter', ${String(counter)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        WHERE admin_auth.value::bigint < ${counter}
        RETURNING key
      `;
      if (!claimed[0]) valid = false; // this code (or a later one) was already used
    }
  }

  if (!valid) {
    recordLoginFailure(ip);
    log.warn('admin.login_failed', { ip });
    return { ok: false, reason: 'invalid' };
  }

  clearLoginFailures(ip);
  const session = randomBytes(32).toString('base64url');
  const exp = Date.now() + TTL_HOURS * 3600 * 1000;
  await pg`
    INSERT INTO admin_auth (key, value) VALUES ('session', ${JSON.stringify({ hash: sha256hex(session), exp })})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  sessionCache = null; // a new login replaces any previous session immediately
  cookies.set(COOKIE, session, {
    path: '/admin',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL_HOURS * 3600
  });
  log.info('admin.login_ok', {});
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Session check (async: DB-backed, with a short cache so /admin pages don't
// pay a query per request; a logout or new login clears it instantly)
// ---------------------------------------------------------------------------
let sessionCache: { hash: string; exp: number; at: number } | null = null;
const SESSION_CACHE_MS = 5000;

export async function isAdmin(cookies: Cookies): Promise<boolean> {
  if (!adminConfig.enabled()) return false;
  const c = cookies.get(COOKIE);
  if (!c) return false;
  const now = Date.now();
  if (!sessionCache || now - sessionCache.at > SESSION_CACHE_MS) {
    const rows = await pg`SELECT value FROM admin_auth WHERE key = 'session'`;
    if (!rows[0]) {
      sessionCache = { hash: '', exp: 0, at: now };
    } else {
      try {
        const v = JSON.parse(rows[0].value as string) as { hash: string; exp: number };
        sessionCache = { hash: v.hash, exp: v.exp, at: now };
      } catch {
        sessionCache = { hash: '', exp: 0, at: now };
      }
    }
  }
  if (!sessionCache.hash || sessionCache.exp < now) return false;
  return safeEqual(sha256hex(c), sessionCache.hash);
}

export async function revokeAdmin(cookies: Cookies): Promise<void> {
  await pg`DELETE FROM admin_auth WHERE key = 'session'`;
  sessionCache = null;
  cookies.delete(COOKIE, { path: '/admin' });
}

export { randomBytes };
