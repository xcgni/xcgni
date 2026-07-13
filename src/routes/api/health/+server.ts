// Liveness + DB reachability + provenance for smoke tests, the deploy loop, and
// post-deploy verification. No auth, no user data; nothing here the footer and the
// public repo do not already disclose - but now it is machine-checkable.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pg } from '$lib/server/db';
import { version } from '$app/environment';
import pkg from '../../../../package.json' with { type: 'json' };

const METHODOLOGY_VERSION = 'm1';

export const GET: RequestHandler = async () => {
  let db = false;
  try {
    await pg`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return json(
    {
      ok: db,
      db,
      version: pkg.version,
      sha: process.env.GIT_SHA ?? 'unknown',
      methodology: METHODOLOGY_VERSION,
      builtAt: process.env.BUILD_TIME ?? 'unknown',
      kitBuild: version
    },
    { status: db ? 200 : 503 }
  );
};
