import type { Handle, HandleServerError } from '@sveltejs/kit';
import { pickLocale } from '$lib/i18n';
import { resolveUser } from '$lib/server/auth';
import { captureError } from '$lib/server/ops/errors';
import { recordVisit } from '$lib/server/ops/visits';
import { maybeRunGc } from '$lib/server/gc';
import { log } from '$lib/server/log';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await resolveUser(event.cookies);
  event.locals.locale = pickLocale(event.cookies.get('xcgni-lang'), event.request.headers.get('accept-language'));
  // Daily housekeeping (abandoned anonymous rows, expired sessions/links) - fires at most
  // once per day per process, in the background, never blocking a request.
  maybeRunGc();

  // Record a first-visit (once per browser, gated by a cookie) for aggregate traffic stats.
  // Only the referrer's host is stored, never linked to a user. Best-effort, never blocks.
  if (!event.cookies.get('excogni_seen') && event.request.method === 'GET') {
    const referer = event.request.headers.get('referer');
    let host: string | null = 'direct';
    if (referer) {
      try {
        const u = new URL(referer);
        // ignore self-referrals (internal navigation)
        host = u.host === event.url.host ? 'direct' : u.host;
      } catch {
        host = 'unknown';
      }
    }
    event.cookies.set('excogni_seen', '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: 'lax'
    });
    recordVisit(host, event.url.pathname).catch(() => {});
  }

  const response = await resolve(event);
  // Baseline security headers (security audit). A strict CSP is deliberately deferred to
  // post-launch (roadmap): adding one untested the day before a traffic wave risks breaking
  // inline styles/hydration; these four are safe, standard, and cost nothing.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HTML must never be cached (browser or CDN): stale HTML references immutable hashed JS
  // chunks that a new deploy deletes - the page then paints but never hydrates (the eternal
  // spinner). Hashed assets under /_app/immutable/ stay long-cached; only documents revalidate.
  const ctype = response.headers.get('content-type') ?? '';
  if (ctype.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-cache, must-revalidate');
  }
  return response;
};

// Every unhandled server error flows through here. We persist it (so it reaches
// the admin Health panel) and return a safe, generic message to the client -
// never a stack trace. The user id is never stored, only a coarse kind.
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const err = error instanceof Error ? error : null;
  const userKind = event.locals.user
    ? (event.locals.user.isAnonymous ? 'anonymous' : 'registered')
    : null;

  const st = status ?? 500;
  log.error('server.error', {
    route: event.route?.id ?? event.url.pathname,
    status: st,
    message: err?.message ?? String(message)
  });

  // Persist ONLY real server errors (>=500) to the Health panel. Scanner bots probing
  // /info.php, /@vite/env, /.vscode/... produce a firehose of 404s that drowned the one
  // signal the panel exists for. 404s still reach the structured log above.
  if (st >= 500) await captureError({
    route: event.route?.id ?? event.url.pathname,
    message: err?.message ?? String(message),
    stack: err?.stack ?? null,
    status: status ?? 500,
    userKind
  });

  return { message: 'Something went wrong on our side. It has been logged.' };
};
