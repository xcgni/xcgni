import type { RequestHandler } from './$types';
import { ensureUser } from '$lib/server/auth';
import { pg } from '$lib/server/db';
import { calibrateFromProbes } from '$lib/server/reaction';
import { touchUserSession } from '$lib/server/sessions';

// Receives probe samples (ms responses to near-zero-cognition flashes) and
// stores the user's personal hardware/input floor + residual uncertainty.
export const POST: RequestHandler = async ({ request, cookies }) => {
  const user = await ensureUser(cookies);
  const body = (await request.json().catch(() => ({}))) as { samples?: number[]; refreshHz?: number };
  const samples = (body.samples ?? []).filter((x) => Number.isFinite(x) && x > 0 && x < 3000);
  if (samples.length < 3) {
    return new Response(JSON.stringify({ error: 'need at least 3 probe samples' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const cal = calibrateFromProbes(samples, body.refreshHz ?? null);
  await pg`
    INSERT INTO user_rt_calibration (user_id, floor_ms, uncertainty_ms, refresh_hz, samples, updated_at)
    VALUES (${user.id}, ${cal.floorMs}, ${cal.uncertaintyMs}, ${cal.refreshHz ?? null}, ${samples.length}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      floor_ms = ${cal.floorMs}, uncertainty_ms = ${cal.uncertaintyMs},
      refresh_hz = ${cal.refreshHz ?? null}, samples = ${samples.length}, updated_at = now()
  `;
  await touchUserSession(user.id); // calibration mid-mix is session activity
  return new Response(JSON.stringify({ calibration: cal }), { headers: { 'content-type': 'application/json' } });
};
