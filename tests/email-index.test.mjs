// Blind email index (v0.66.0). The module reads EMAIL_INDEX_KEY through SvelteKit's
// $env/dynamic/private, which resolves to process.env at runtime - set before import.
//   node --experimental-strip-types tests/email-index.test.mjs
process.env.EMAIL_INDEX_KEY = 'test-key-0123456789-0123456789-0123456789';

const { emailIndex, emailHint, emailIndexEnabled, normalizeEmail, emailIndexKey } =
  await import('../src/lib/server/auth/email-index.ts');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); } }

// --- key gating ---
ok('enabled with a >=32 char key', emailIndexEnabled() === true);
ok('key accessor returns the key', emailIndexKey() === 'test-key-0123456789-0123456789-0123456789');

// --- determinism + normalization: the SAME address always maps to the SAME index ---
const h = emailIndex('someone@example.com');
ok('index is 64 hex chars (sha256)', /^[0-9a-f]{64}$/.test(h));
ok('deterministic', emailIndex('someone@example.com') === h);
ok('case-insensitive', emailIndex('Someone@Example.COM') === h);
ok('whitespace-insensitive', emailIndex('  someone@example.com  ') === h);
ok('different address -> different index', emailIndex('other@example.com') !== h);

// --- it is an HMAC, not a plain hash: without the key the digest differs ---
const { createHash } = await import('node:crypto');
ok('NOT equal to plain sha256 of the address (pepper matters)',
  h !== createHash('sha256').update('someone@example.com').digest('hex'));

// --- hint masking ---
ok('typical hint', emailHint('someone@gmail.com') === 's…@g….com');
ok('subdomain keeps only the last dot as TLD', emailHint('a@mail.initsix.dev') === 'a…@m….dev');
ok('short local part', emailHint('x@y.hr') === 'x…@y….hr');
ok('dotless domain degrades gracefully', emailHint('a@localhost') === 'a…@l…');
ok('garbage degrades to ellipsis', emailHint('nonsense') === '…');
ok('hint never contains the full local part', !emailHint('someone@gmail.com').includes('someone'));

// --- normalizeEmail ---
ok('normalize lowercases and trims', normalizeEmail('  A@B.Com ') === 'a@b.com');

console.log(`\nEmail-index tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL EMAIL-INDEX TESTS PASSED' : 'EMAIL-INDEX TESTS FAILED');
if (fail > 0) process.exit(1);
