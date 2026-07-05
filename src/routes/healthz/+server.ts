import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { pg } from '$lib/server/db';

// Unauthenticated liveness/readiness probe for uptime monitors, load balancers,
// and container orchestrators. Returns 200 with a DB ping, 503 if the DB is down.
// Distinct from the human-facing admin Health panel.
export const GET: RequestHandler = async () => {
  // no-store is load-bearing: a CDN-cached 200 would mask a real outage from monitors
  const h = { 'Cache-Control': 'no-store' };
  try {
    await pg`SELECT 1`;
    return json({ status: 'ok', time: new Date().toISOString() }, { headers: h });
  } catch {
    return json({ status: 'degraded', reason: 'database unreachable' }, { status: 503, headers: h });
  }
};
