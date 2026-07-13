// Liveness + DB reachability for smoke tests and the deploy loop. No auth, no
// user data, no version leak beyond what the public footer already shows.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';

export const GET: RequestHandler = async () => {
  let db = false;
  try {
    await pg`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return json({ ok: db, db }, { status: db ? 200 : 503 });
};
