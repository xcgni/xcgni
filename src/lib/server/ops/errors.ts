import { pg } from '$lib/server/db';
import { log } from '$lib/server/log';

// Persist a server error so it reaches the operator (admin Health panel) instead
// of vanishing into container logs. Never stores the user id - only a coarse
// 'anonymous' | 'registered' kind - and truncates to keep rows bounded.
export async function captureError(params: {
  route?: string | null;
  message: string;
  stack?: string | null;
  status?: number | null;
  userKind?: 'anonymous' | 'registered' | null;
}): Promise<void> {
  const route = (params.route ?? null)?.slice(0, 300) ?? null;
  const message = params.message.slice(0, 2000);
  const stack = params.stack ? params.stack.slice(0, 6000) : null;
  try {
    await pg`
      INSERT INTO error_log (route, message, stack, status, user_kind)
      VALUES (${route}, ${message}, ${stack}, ${params.status ?? null}, ${params.userKind ?? null})
    `;
  } catch (e) {
    // last resort: if even the DB write fails, at least hit stdout
    log.error('error_log.write_failed', { reason: e instanceof Error ? e.message : 'unknown' });
  }
}
