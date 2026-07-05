// Generates a fresh ADMIN_TOTP_SECRET (160-bit, base32) and prints the current code so
// you can verify your authenticator app is in sync before locking yourself out.
// Dependency-free: node --experimental-strip-types scripts/gen-totp-secret.mjs
import { randomBytes } from 'node:crypto';
import { base32Encode, currentTotp, base32Decode } from '../src/lib/server/admin/totp.ts';

const secret = randomBytes(20); // 160 bits, the RFC 4226 recommended size
const b32 = base32Encode(secret);

console.log('ADMIN_TOTP_SECRET=' + b32);
console.log('');
console.log('1. Put the line above in your production env file.');
console.log('2. In your authenticator app, add an account by manual key entry:');
console.log('   - name: Excogni admin');
console.log('   - key:  ' + b32);
console.log('   - type: time-based (TOTP), SHA1, 6 digits, 30s - the defaults everywhere.');
console.log('3. Verify before deploying: the app should show this code RIGHT NOW:');
console.log('   ' + currentTotp(base32Decode(b32)));
console.log('   (30s window - if it just rolled over, run the script again to re-check.)');
