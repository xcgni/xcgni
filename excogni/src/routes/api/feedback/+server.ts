import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pg } from '$lib/server/db';
import { log } from '$lib/server/log';

const KINDS = ['bug', 'confusing', 'idea', 'methodology', 'inconsistency', 'other'];

// Lightweight in-memory rate limit: max submissions per window per client key.
// Not bulletproof across instances, but stops casual flooding of the table.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  // opportunistic cleanup
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return false;
}

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  const key = locals.user?.id ?? (() => { try { return getClientAddress(); } catch { return 'unknown'; } })();
  if (rateLimited(key)) {
    return json({ error: 'Too many submissions - please wait a moment.' }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    kind?: string; message?: string; route?: string;
    snapshot?: unknown; image?: string;
  };
  const message = (body.message ?? '').trim().slice(0, 2000);
  if (!message) return json({ error: 'empty' }, { status: 400 });
  const kind = KINDS.includes(body.kind ?? '') ? body.kind : 'other';
  const route = (body.route ?? '').slice(0, 300) || null;
  const userId = locals.user?.id ?? null;
  // snapshot: structured state (small JSON). image: optional best-effort data-URL, capped to keep
  // the row sane - a too-large image is dropped rather than bloating the table.
  const snapshot = body.snapshot ? JSON.stringify(body.snapshot).slice(0, 8000) : null;
  const image = typeof body.image === 'string' && body.image.length < 600_000 ? body.image : null;
  try {
    await pg`
      INSERT INTO feedback (user_id, route, kind, message, snapshot, image)
      VALUES (${userId}, ${route}, ${kind}, ${message}, ${snapshot}::jsonb, ${image})
    `;
    log.info('feedback.received', { kind: kind ?? 'other' });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'could not save' }, { status: 500 });
  }
};
