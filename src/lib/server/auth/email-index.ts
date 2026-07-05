import { createHmac } from 'node:crypto';

/**
 * Blind email index (v0.66.0). The login email is never stored readable: the DB holds
 * HMAC-SHA256(normalized email, EMAIL_INDEX_KEY) for lookup/uniqueness, plus a masked
 * hint ("b…@g….com") for display. The KEY lives only in the server environment - the
 * same separation as the hashed bearer tokens: a DB dump alone is not brute-forceable
 * against dictionaries of common addresses, because the attacker does not have the key.
 *
 * A plain unsalted SHA-256 would NOT achieve this - emails are low-entropy and a dump
 * could be matched offline against millions of known addresses in minutes. The HMAC
 * pepper is what makes the index blind.
 *
 * Why this fits Excogni specifically: login is magic-link only, and the user types the
 * address at every login - so the plaintext exists in memory exactly when it is needed
 * (to send the link) and never has to be persisted. Reminders are client-side
 * notifications; nothing in the product initiates outbound email from storage.
 *
 * The accepted trade-offs, stated plainly (also in SECURITY.md):
 *  - The project cannot email its users unprompted - including breach notification by
 *    email. The public changelog and in-app notice are the notification channels.
 *  - A forgotten address cannot be recovered from the DB, only re-verified by typing it.
 *
 * Legacy mode: without EMAIL_INDEX_KEY (dev, zero-config) the plaintext column keeps
 * working exactly as before. consumeMagicLink converts legacy rows lazily on login;
 * scripts/backfill-email-hash.mjs converts them in bulk.
 */

export function emailIndexKey(): string | null {
  const k = (process.env.EMAIL_INDEX_KEY || '').trim();
  return k.length >= 32 ? k : null; // a short pepper is a false promise; refuse it
}

export function emailIndexEnabled(): boolean {
  return emailIndexKey() !== null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** HMAC-SHA256 hex of the normalized address, or null when no key is configured. */
export function emailIndex(raw: string): string | null {
  const key = emailIndexKey();
  if (!key) return null;
  return createHmac('sha256', key).update(normalizeEmail(raw)).digest('hex');
}

/**
 * Masked display form: enough to recognise your own address, useless to anyone else.
 * "someone@gmail.com" -> "s…@g….com"; short locals/domains degrade gracefully.
 */
export function emailHint(raw: string): string {
  const email = normalizeEmail(raw);
  const at = email.lastIndexOf('@');
  if (at <= 0) return '…';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  const tld = lastDot > 0 ? domain.slice(lastDot) : '';
  const domainHead = lastDot > 0 ? domain.slice(0, lastDot) : domain;
  return `${local[0]}…@${domainHead[0] ?? ''}…${tld}`;
}
