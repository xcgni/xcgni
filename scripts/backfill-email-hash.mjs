// One-time (idempotent) conversion to the blind email index (v0.66.0).
// For every user with a plaintext email and no hash: sets email_hash + email_hint,
// then NULLs the plaintext. Also scrubs plaintext addresses from magic_links history
// (consumed rows keep no address; pending legacy links are simply deleted - they are
// 30-minute ephemera and the person can request a fresh one).
//
// Requires EMAIL_INDEX_KEY (>= 32 chars) and DATABASE_URL in the environment:
//   EMAIL_INDEX_KEY=... DATABASE_URL=... node scripts/backfill-email-hash.mjs
//
// Lazy conversion also happens automatically at each login (createMagicLink), so this
// script is a bulk fast-forward, not a requirement - but run it once at deploy so no
// plaintext lingers for accounts that never log in again.
import { createHmac } from 'node:crypto';
import postgres from 'postgres';

const KEY = (process.env.EMAIL_INDEX_KEY || '').trim();
if (KEY.length < 32) {
  console.error('EMAIL_INDEX_KEY missing or shorter than 32 chars; refusing to run.');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

const sql = postgres(url);

const hmac = (email) => createHmac('sha256', KEY).update(email.trim().toLowerCase()).digest('hex');
const hint = (raw) => {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return '…';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  const tld = lastDot > 0 ? domain.slice(lastDot) : '';
  const head = lastDot > 0 ? domain.slice(0, lastDot) : domain;
  return `${local[0]}…@${head[0] ?? ''}…${tld}`;
};

const rows = await sql`SELECT id, email FROM users WHERE email IS NOT NULL AND email_hash IS NULL`;
let converted = 0;
for (const r of rows) {
  await sql`
    UPDATE users SET email_hash = ${hmac(r.email)}, email_hint = ${hint(r.email)}, email = NULL
    WHERE id = ${r.id} AND email_hash IS NULL
  `;
  converted++;
}
console.log(`users converted: ${converted}`);

const scrubbed = await sql`UPDATE magic_links SET email = NULL WHERE email IS NOT NULL AND consumed_at IS NOT NULL`;
console.log(`consumed magic-link rows scrubbed: ${scrubbed.count}`);
const dropped = await sql`DELETE FROM magic_links WHERE email IS NOT NULL AND consumed_at IS NULL`;
console.log(`pending legacy links deleted: ${dropped.count}`);

const remaining = await sql`SELECT count(*)::int AS n FROM users WHERE email IS NOT NULL`;
console.log(remaining[0].n === 0 ? 'no plaintext emails remain' : `WARNING: ${remaining[0].n} plaintext emails remain`);
await sql.end();
