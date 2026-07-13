import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) over HOTP (RFC 4226) with HMAC-SHA1, 30s period, 6 digits -
 * the profile every authenticator app (Aegis, Google Authenticator, 1Password,
 * FreeOTP...) speaks by default. Dependency-free: node:crypto only.
 *
 * The secret is base32 (RFC 4648) because that's what authenticator apps accept
 * as manual entry. Generate one with: node --experimental-strip-types scripts/gen-totp-secret.mjs
 */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decodes RFC 4648 base32 (case-insensitive, padding and spaces tolerated). Null on junk. */
export function base32Decode(input: string): Buffer | null {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return out.length ? Buffer.from(out) : null;
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** HOTP (RFC 4226): HMAC-SHA1 + dynamic truncation, zero-padded to `digits`. */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  // counter as big-endian 64-bit; JS numbers are exact to 2^53, far beyond any epoch/30
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const mac = createHmac('sha1', secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

function codesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface TotpOptions {
  period?: number; // seconds per step (default 30)
  digits?: number; // code length (default 6)
  window?: number; // steps of clock drift tolerated each way (default 1)
  now?: number; // ms epoch, injectable for tests
}

/**
 * Verifies a TOTP code against the secret. Returns the MATCHED COUNTER (time step)
 * on success, or null. The caller must enforce counter monotonicity (reject any
 * counter <= the last accepted one) - that is what makes a code single-use and
 * kills shoulder-surf replay within the validity window.
 */
export function verifyTotp(secret: Buffer, code: string, opts: TotpOptions = {}): number | null {
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const window = opts.window ?? 1;
  const now = opts.now ?? Date.now();
  const clean = code.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(clean)) return null;
  const counter = Math.floor(now / 1000 / period);
  // check every candidate (no early exit) so timing does not reveal WHICH step matched
  let matched: number | null = null;
  for (let i = -window; i <= window; i++) {
    if (codesEqual(hotp(secret, counter + i, digits), clean) && matched === null) {
      matched = counter + i;
    }
  }
  return matched;
}

/** Current code for a secret - used by the generator script for setup verification. */
export function currentTotp(secret: Buffer, opts: TotpOptions = {}): string {
  const period = opts.period ?? 30;
  const now = opts.now ?? Date.now();
  return hotp(secret, Math.floor(now / 1000 / period), opts.digits ?? 6);
}
