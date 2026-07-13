import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logout } from '$lib/server/auth';

export const GET: RequestHandler = async ({ cookies }) => {
  await logout(cookies);
  throw redirect(303, '/');
};
