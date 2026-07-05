// Minimal structured logger. JSON lines to stdout so they're greppable in
// `docker compose logs`. No PII beyond what's necessary; tokens are never logged.

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
  authMagicCreated: (email: string) => emit('info', 'auth.magic_link.created', { email }),
  authMagicConsumed: (ok: boolean) => emit(ok ? 'info' : 'warn', 'auth.magic_link.consumed', { ok }),
  authMagicRateLimited: (email: string) => emit('warn', 'auth.magic_link.rate_limited', { email }),
  sessionCreated: (userId: string) => emit('info', 'session.created', { userId }),
  challengeError: (reason: string, fields?: Fields) => emit('error', 'challenge.error', { reason, ...fields }),
  ratingError: (reason: string, fields?: Fields) => emit('error', 'rating.error', { reason, ...fields }),
  validationError: (reason: string, fields?: Fields) => emit('warn', 'validation.error', { reason, ...fields })
};
