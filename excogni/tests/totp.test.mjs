// TOTP/HOTP pinned to the OFFICIAL RFC test vectors - if this implementation drifts from
// what every authenticator app computes, these fail before the admin gets locked out.
//   node --experimental-strip-types tests/totp.test.mjs
import { hotp, verifyTotp, currentTotp, base32Decode, base32Encode } from '../src/lib/server/admin/totp.ts';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', name); } }

const SECRET = Buffer.from('12345678901234567890', 'ascii'); // the RFC shared secret

// --- RFC 4226 Appendix D: HOTP vectors, counters 0..9 ---
const HOTP_VECTORS = ['755224','287082','359152','969429','338314','254676','287922','162583','399871','520489'];
HOTP_VECTORS.forEach((expect, counter) => {
  ok(`RFC 4226 counter ${counter} -> ${expect}`, hotp(SECRET, counter) === expect);
});

// --- RFC 6238 Appendix B: TOTP SHA1 vectors (8 digits in the RFC; we verify via hotp on T) ---
const TOTP_VECTORS = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130']
];
for (const [t, expect] of TOTP_VECTORS) {
  ok(`RFC 6238 T=${t} -> ${expect}`, hotp(SECRET, Math.floor(t / 30), 8) === expect);
}

// --- verifyTotp behavior ---
const nowMs = 1111111111 * 1000;
ok('accepts the current step code', verifyTotp(SECRET, hotp(SECRET, Math.floor(1111111111 / 30)), { now: nowMs }) !== null);
ok('returned counter is the matched time-step',
  verifyTotp(SECRET, hotp(SECRET, Math.floor(1111111111 / 30)), { now: nowMs }) === Math.floor(1111111111 / 30));
ok('accepts previous step (clock drift, window 1)',
  verifyTotp(SECRET, hotp(SECRET, Math.floor(1111111111 / 30) - 1), { now: nowMs }) === Math.floor(1111111111 / 30) - 1);
ok('accepts next step (clock drift, window 1)',
  verifyTotp(SECRET, hotp(SECRET, Math.floor(1111111111 / 30) + 1), { now: nowMs }) !== null);
ok('rejects a step outside the window',
  verifyTotp(SECRET, hotp(SECRET, Math.floor(1111111111 / 30) + 2), { now: nowMs }) === null);
ok('rejects a wrong code', verifyTotp(SECRET, '000000', { now: nowMs }) === null || hotp(SECRET, Math.floor(1111111111/30)) === '000000');
ok('rejects junk (letters)', verifyTotp(SECRET, 'abc123', { now: nowMs }) === null);
ok('rejects wrong length', verifyTotp(SECRET, '12345', { now: nowMs }) === null);
ok('tolerates spaces in the code (apps display "123 456")',
  verifyTotp(SECRET, hotp(SECRET, Math.floor(1111111111 / 30)).replace(/^(...)/, '$1 '), { now: nowMs }) !== null);

// --- base32 (RFC 4648) ---
ok('base32 encodes the RFC secret', base32Encode(SECRET) === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
ok('base32 round-trip', base32Decode(base32Encode(SECRET))?.equals(SECRET) === true);
ok('base32 tolerates lowercase and spaces', base32Decode('gezd gnbv gy3t qojq gezd gnbv gy3t qojq')?.equals(SECRET) === true);
ok('base32 rejects junk', base32Decode('not!base32') === null);
ok('base32 rejects empty', base32Decode('') === null);

// --- currentTotp matches hotp at the current step ---
ok('currentTotp = hotp(now/30)', currentTotp(SECRET, { now: nowMs }) === hotp(SECRET, Math.floor(1111111111 / 30)));

console.log(`\nTOTP tests: ${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'ALL TOTP TESTS PASSED' : 'TOTP TESTS FAILED');
if (fail > 0) process.exit(1);
