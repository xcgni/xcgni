// Minimal structured logger. JSON lines to stdout so they're greppable in
// `docker compose logs`. No PII beyond what's necessary; tokens are never logged.

// Email masking for log lines (mirrors emailHint; local copy to keep this module
// dependency-free). "someone@gmail.com" -> "s…@g….com". Logs are data too.
function maskForLog(e: string): string {
  const [lo, dom] = e.split('@');
  if (!dom) return '<invalid>';
  const parts = dom.split('.');
  const d0 = parts[0] ?? '';
  const tld = parts.length > 1 ? parts[parts.length - 1] : '';
  return `${lo.slice(0, 1)}\u2026@${d0.slice(0, 1)}\u2026${tld ? '.' + tld : ''}`;
}

type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, string | number | boolean | null | undefined>;

function emit(level: Level, event: string, fields: Fields = {}) {
  const line = { ts: new Date().toISOString(), level, event, ...fields };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export const log = {
  info: (event: string, fields?: Fields) => emit('info', event, fields),
  warn: (event: string, fields?: Fields) => emit('warn', event, fields),
  error: (event: string, fields?: Fields) => emit('error', event, fields),

  // typed helpers for the events the appendix asks for
  // NB: callers pass the raw address; masked HERE so no call site can forget
  authMagicCreated: (email: string) => emit('info', 'auth.magic_link.created', { email: maskForLog(email) }),
  authMagicConsumed: (ok: boolean) => emit(ok ? 'info' : 'warn', 'auth.magic_link.consumed', { ok }),
  authMagicRateLimited: (email: string) => emit('warn', 'auth.magic_link.rate_limited', { email: maskForLog(email) }),
  sessionCreated: (userId: string) => emit('info', 'session.created', { userId }),
  challengeError: (reason: string, fields?: Fields) => emit('error', 'challenge.error', { reason, ...fields }),
  ratingError: (reason: string, fields?: Fields) => emit('error', 'rating.error', { reason, ...fields }),
  validationError: (reason: string, fields?: Fields) => emit('warn', 'validation.error', { reason, ...fields })
};
