import type { SessionUser } from '$lib/server/auth';

declare global {
  namespace App {
    interface Locals {
      locale: import('$lib/i18n').Locale;
      user: SessionUser | null;
    }
  }
}

export {};
