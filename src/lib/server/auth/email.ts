// Pragmatic email validation. Not RFC-5322-exhaustive (that's a famously huge
// regex that still accepts addresses no real mail server uses) - instead it
// rejects the things that actually slip through naive `includes('@')` checks:
// missing parts, single-letter TLDs (m@m.m), bad dots, junk characters. The real
// proof an address works is whether the magic link arrives; this just stops the
// obviously-invalid before we bother sending.

export interface EmailCheck {
  valid: boolean;
  reason?: string;
}

// A label (between dots) in the domain: letters/digits/hyphen, no leading/trailing
// hyphen, 1-63 chars.
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
// Local part: common, conservative set. Allows dots but not at the ends or doubled.
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

export function validateEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();

  if (!email) return { valid: false, reason: 'empty' };
  if (email.length > 254) return { valid: false, reason: 'too long' };
  if (/\s/.test(email)) return { valid: false, reason: 'contains whitespace' };

  // exactly one @
  const at = email.indexOf('@');
  if (at === -1 || at !== email.lastIndexOf('@')) {
    return { valid: false, reason: 'must contain exactly one @' };
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (!local) return { valid: false, reason: 'missing the part before @' };
  if (local.length > 64) return { valid: false, reason: 'local part too long' };
  if (!LOCAL.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return { valid: false, reason: 'invalid characters before @' };
  }

  if (!domain) return { valid: false, reason: 'missing the domain after @' };
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return { valid: false, reason: 'invalid domain' };
  }

  const labels = domain.split('.');
  // a real domain has at least one dot (a name + a TLD)
  if (labels.length < 2) return { valid: false, reason: 'domain needs a TLD (e.g. example.com)' };
  if (labels.some((l) => !LABEL.test(l))) {
    return { valid: false, reason: 'invalid domain' };
  }

  // TLD sanity: at least 2 chars and all letters (rejects m@m.m, foo@bar.1)
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || !/^[a-z]{2,}$/.test(tld)) {
    return { valid: false, reason: 'invalid top-level domain' };
  }

  return { valid: true };
}
