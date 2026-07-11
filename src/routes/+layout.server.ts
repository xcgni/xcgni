import type { LayoutServerLoad } from './$types';
import { readFileSync } from 'node:fs';
import { flags } from '$lib/server/flags';
import { resolveAllFlags } from '$lib/server/runtime-flags';

const VARIANTS = ['serious', 'warm', 'slate', 'phosphor', 'ion', 'playful', 'kids'];

// Read the app version once at module load (server-side only; safe - no DB, no env needed).
let APP_VERSION = '';
try {
  APP_VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version ?? '';
} catch {
  APP_VERSION = '';
}

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
  // Variant skin: the mobile shells load the same backend with ?variant=<key>. We persist
  // it in a cookie so it survives navigation within the app. Defaults to 'serious'.
  const fromUrl = url.searchParams.get('variant');
  if (fromUrl && VARIANTS.includes(fromUrl)) {
    cookies.set('variant', fromUrl, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false, sameSite: 'lax' });
  }
  const variant = fromUrl && VARIANTS.includes(fromUrl) ? fromUrl : (cookies.get('variant') ?? 'serious');

  return {
    locale: locals.locale,

    variant,
    version: APP_VERSION,
    circlesEnabled: (await resolveAllFlags().then(() => flags.circlesEnabled())),
    user: locals.user
      ? {
          emailHint: locals.user.emailHint,
          username: locals.user.username,
          isAnonymous: locals.user.isAnonymous
        }
      : null
  };
};
