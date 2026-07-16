import { db, pg } from '$lib/server/db';
import { log } from '$lib/server/log';
import { users, authSessions, magicLinks } from '$lib/server/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import { emailIndex, emailHint, normalizeEmail } from './email-index';
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'excogni_sid';
const SESSION_DAYS = 90;
const MAGIC_LINK_MINUTES = 30;

export type SessionUser = {
  id: string;
  /** Masked display form of the login email ("b…@g….com"); the plaintext address in
   *  legacy mode (no EMAIL_INDEX_KEY). The readable address is otherwise never stored. */
  emailHint: string | null;
  username: string | null;
  isAnonymous: boolean;
  isTest: boolean;
};

// shared selection + mapper so every path builds the SessionUser the same way
const sessionUserCols = {
  id: users.id, email: users.email, emailHint: users.emailHint, username: users.username,
  isAnonymous: users.isAnonymous, isTest: users.isTest
};
function toSessionUser(r: { id: string; email: string | null; emailHint: string | null;
  username: string | null; isAnonymous: boolean; isTest: boolean }): SessionUser {
  return { id: r.id, emailHint: r.emailHint ?? r.email, username: r.username,
    isAnonymous: r.isAnonymous, isTest: r.isTest };
}

function token(): string {
  return randomBytes(32).toString('base64url');
}

// Bearer tokens are stored as sha256 hex (v0.66.0): the DB holds only the hash, the raw
// value lives in the cookie or the emailed link. A leaked DB yields nothing usable.
function tokenHash(t: string): string {
  return createHash('sha256').update(t).digest('hex');
}

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
}

export function setSessionCookie(cookies: Cookies, value: string) {
  cookies.set(SESSION_COOKIE, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // Secure except when explicitly testing a production build over plain http
    // (INSECURE_COOKIES=1 in a LOCAL .env only - never on a server). Without this,
    // localhost testing silently drops the cookie and every request is a stranger.
    secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== '1',
    maxAge: SESSION_DAYS * 24 * 3600
  });
}

export async function createSessionFor(userId: string, cookies: Cookies) {
  const t = token();
  await db.insert(authSessions).values({ userId, token: tokenHash(t), expiresAt: sessionExpiry() });
  setSessionCookie(cookies, t);
}

// ---- Generated usernames (reddit-style): identity without exposing the email ----
// Small curated lists; ~40x40x90 = 144k combinations, retried on the unique constraint.
const UN_ADJ = ['quiet','steady','bright','swift','calm','sharp','patient','curious','lucid','keen',
  'nimble','sober','vivid','subtle','earnest','wry','deft','stoic','limber','placid',
  'astute','candid','mellow','brisk','gentle','sound','level','clear','exact','tidy',
  'spry','shrewd','poised','intent','awake','alert','fluent','steadfast','measured','composed'];
const UN_NOUN = ['falcon','otter','heron','lynx','badger','osprey','marten','ibex','curlew','plover',
  'kestrel','stoat','vole','tern','siskin','grouse','pine','cedar','alder','rowan',
  'quartz','basalt','flint','slate','vector','axiom','cipher','sigma','delta','prism',
  'sextant','compass','pendulum','gnomon','meridian','zenith','abacus','sonde','caliper','beacon'];

function generateUsername(): string {
  const a = UN_ADJ[Math.floor(Math.random() * UN_ADJ.length)];
  const n = UN_NOUN[Math.floor(Math.random() * UN_NOUN.length)];
  const num = 10 + Math.floor(Math.random() * 90);
  return `${a}-${n}-${num}`;
}

/** Assign a generated username to a registered user who has none. Retries on collision;
 *  returns the username (existing or new). Never touches anonymous users. */
export async function ensureUsername(userId: string, current: string | null): Promise<string | null> {
  if (current) return current;
  for (let i = 0; i < 6; i++) {
    const candidate = generateUsername();
    try {
      const r = await db.update(users).set({ username: candidate })
        .where(and(eq(users.id, userId), isNull(users.username))).returning({ username: users.username });
      if (r[0]?.username) return r[0].username;
      // no row updated: someone assigned concurrently - read and return it
      const cur = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
      return cur[0]?.username ?? null;
    } catch { /* unique collision - try the next candidate */ }
  }
  return null; // extraordinarily unlucky; the email fallback still works
}

export async function resolveUser(cookies: Cookies): Promise<SessionUser | null> {
  const t = cookies.get(SESSION_COOKIE);
  if (!t) return null;
  const rows = await db
    .select(sessionUserCols)
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.token, tokenHash(t)), gt(authSessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0] ? toSessionUser(rows[0]) : null;
  // Identity hygiene: a registered account always carries a generated username, so no surface
  // ever has to fall back to showing the email. Lazy one-time assignment covers accounts that
  // registered before usernames existed.
  if (u && !u.isAnonymous && !u.username) {
    u.username = await ensureUsername(u.id, u.username);
  }
  return u;
}

/** Returns the current user, creating an anonymous one (with session cookie) if needed. */
export async function ensureUser(cookies: Cookies): Promise<SessionUser> {
  const existing = await resolveUser(cookies);
  if (existing) return existing;
  const [u] = await db.insert(users).values({ isAnonymous: true }).returning(sessionUserCols);
  log.info('anon-user-created', { userId: u.id });
  await createSessionFor(u.id, cookies);
  return toSessionUser(u);
}

export async function logout(cookies: Cookies) {
  const t = cookies.get(SESSION_COOKIE);
  if (t) await db.delete(authSessions).where(eq(authSessions.token, tokenHash(t)));
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

// ---------------------------------------------------------------------------
// Magic links
// ---------------------------------------------------------------------------

const MAGIC_RATE_MAX = 5; // per email per window
const MAGIC_RATE_WINDOW_MIN = 15;

export type MagicLinkResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'rate_limited' };

/**
 * Creates a magic link, rate-limited per email (and per IP when provided)
 * to MAGIC_RATE_MAX within MAGIC_RATE_WINDOW_MIN minutes. This prevents
 * flooding the table and, once SMTP is live, mail-bombing arbitrary addresses.
 */
export async function createMagicLink(email: string, ip?: string | null): Promise<MagicLinkResult> {
  const normEmail = normalizeEmail(email);
  const hash = emailIndex(normEmail); // null in legacy mode (no EMAIL_INDEX_KEY)
  const since = new Date(Date.now() - MAGIC_RATE_WINDOW_MIN * 60 * 1000);

  // rate-limit key: the blind index when configured, the plaintext otherwise -
  // either way the SAME address always maps to the same key, so the limit holds
  const rateKey = hash ?? normEmail;
  const recent = await pg`
    SELECT count(*)::int AS n FROM magic_link_requests
    WHERE created_at > ${since} AND (email_key = ${rateKey} OR (${ip ?? null}::text IS NOT NULL AND ip = ${ip ?? null}))
  `;
  if ((recent[0]?.n ?? 0) >= MAGIC_RATE_MAX) {
    return { ok: false, reason: 'rate_limited' };
  }

  await pg`INSERT INTO magic_link_requests (email_key, ip) VALUES (${rateKey}, ${ip ?? null})`;
  // Rate-limit rows carry an IP and are worthless past the window - prune opportunistically
  // (24h grace, no cron needed). Storing IPs indefinitely would undercut the privacy claims.
  await pg`DELETE FROM magic_link_requests WHERE created_at < now() - interval '24 hours'`;

  if (hash) {
    // The plaintext is in hand RIGHT NOW (the user just typed it) - this is the one
    // moment a legacy row (plaintext email, no hash yet) can be converted. Lazy,
    // idempotent, and it means consume never needs the plaintext at all.
    await pg`
      UPDATE users SET email_hash = ${hash}, email_hint = ${emailHint(normEmail)}, email = NULL
      WHERE email = ${normEmail} AND email_hash IS NULL
    `;
  }

  const t = token();
  await db.insert(magicLinks).values({
    // hash mode stores NO readable address on the link row; the send happens in-memory
    email: hash ? null : normEmail,
    emailHash: hash,
    emailHint: hash ? emailHint(normEmail) : null,
    token: tokenHash(t),
    expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60 * 1000)
  });
  // TODO(production): send the link via SMTP here. See src/lib/server/auth/mail.ts.
  return { ok: true, token: t };
}

/**
 * Consumes a magic link token. If the current visitor is an anonymous user,
 * their existing user row is upgraded in place so their history is preserved.
 *
 * Consumption is a single atomic UPDATE (claim-or-nothing): two racing requests
 * with the same link can never both succeed. The session is rotated on the
 * anonymous->registered upgrade so the pre-login token does not carry into the
 * authenticated account (session-fixation hygiene).
 */
export async function consumeMagicLink(t: string, cookies: Cookies): Promise<SessionUser | null> {
  const claimed = await pg`
    UPDATE magic_links SET consumed_at = now()
    WHERE token = ${tokenHash(t)} AND consumed_at IS NULL AND expires_at > now()
    RETURNING email, email_hash, email_hint
  `;
  const link = claimed[0] as { email: string | null; email_hash: string | null; email_hint: string | null } | undefined;
  if (!link) return null;
  // identity carried by the link: the blind index in hash mode, plaintext in legacy mode
  const identity = link.email_hash
    ? { emailHash: link.email_hash, emailHint: link.email_hint, email: null as string | null }
    : { emailHash: null as string | null, emailHint: null as string | null, email: link.email };
  if (!identity.emailHash && !identity.email) return null; // malformed row; refuse quietly

  // existing account with this identity? (legacy plaintext rows were already converted
  // at link-creation time when the index key is configured, so ONE lookup suffices)
  const found = await db.select(sessionUserCols).from(users)
    .where(identity.emailHash
      ? eq(users.emailHash, identity.emailHash)
      : eq(users.email, identity.email as string))
    .limit(1);

  if (found[0]) {
    await createSessionFor(found[0].id, cookies);
    return toSessionUser(found[0]);
  }

  // upgrade current anonymous user if present, else create fresh registered user
  const current = await resolveUser(cookies);
  if (current && current.isAnonymous) {
    const [u] = await db.update(users)
      .set({ ...identity, isAnonymous: false })
      .where(eq(users.id, current.id))
      .returning(sessionUserCols);
    // rotate: the pre-login (anonymous) session token must not carry into the account
    const old = cookies.get(SESSION_COOKIE);
    if (old) await db.delete(authSessions).where(eq(authSessions.token, tokenHash(old)));
    await createSessionFor(u.id, cookies);
    return toSessionUser(u);
  }

  const [u] = await db.insert(users).values({ ...identity, isAnonymous: false })
    .returning(sessionUserCols);
  await createSessionFor(u.id, cookies);
  return toSessionUser(u);
}

// ---------------------------------------------------------------------------
// Dev/test username+password login (flag-gated)
// ---------------------------------------------------------------------------


