import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * Android App Links verification. Serving this at /.well-known/assetlinks.json lets Android open
 * https://xcgni.com/auth/magic* links directly INSIDE the app (so magic-link login lands in the
 * app's session, not the browser). The SHA-256 fingerprint of the app's signing certificate must
 * be provided via env ANDROID_CERT_SHA256 (comma-separated if several: upload key + Play App
 * Signing key). Until it's set, this returns 404 so nothing half-configured is ever served.
 * Get the fingerprint: Play Console -> Setup -> App integrity, or:
 *   keytool -list -v -keystore upload.keystore | grep SHA256
 */
export const GET: RequestHandler = async () => {
  const raw = (env.ANDROID_CERT_SHA256 ?? '').trim();
  if (!raw) return new Response('Not configured', { status: 404 });
  const prints = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'dev.initsix.excogni',
        sha256_cert_fingerprints: prints
      }
    }
  ]);
};
