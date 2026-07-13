import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createMagicLink } from '$lib/server/auth';
import { validateEmail } from '$lib/server/auth/email';
import { sendMagicLinkEmail } from '$lib/server/auth/mail';
import { flags } from '$lib/server/flags';
import { log } from '$lib/server/log';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user && !locals.user.isAnonymous) throw redirect(303, '/practice');
  return {
    expired: url.searchParams.get('expired') === '1',
    invalid: url.searchParams.get('invalid') === '1',
    redirectTo: url.searchParams.get('redirect') ?? null
  };
};

function safeRedirect(target: string | null): string {
  // only allow same-site relative paths; never an absolute URL
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/practice';
  return target;
}

export const actions: Actions = {
  magic: async ({ request, getClientAddress }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const redirectTo = safeRedirect(String(form.get('redirect') ?? '') || null);
    if (!validateEmail(email).valid) {
      return fail(400, { magicError: 'Enter a valid email address.' });
    }

    let ip: string | null = null;
    try { ip = getClientAddress(); } catch { ip = null; }

    const result = await createMagicLink(email, ip);
    if (!result.ok) {
      log.authMagicRateLimited(email);
      return fail(429, { magicError: 'Too many requests. Please wait a few minutes and try again.' });
    }
    log.authMagicCreated(email);

    const origin = env.ORIGIN || 'http://localhost:3000';
    const link = `${origin}/auth/magic?token=${result.token}&redirect=${encodeURIComponent(redirectTo)}`;
    await sendMagicLinkEmail(email, link); // stub logs to console; real SMTP later

    if (flags.exposeMagicLinks()) {
      return { magicSent: true, email, devLink: link };
    }
    return { magicSent: true, email };
  }
};
