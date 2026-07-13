import { validateEmail } from '../src/lib/server/auth/email.ts';

let failures = 0;
function ok(name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failures++; }

const reject = ['m@m.m', 'a@b', 'foo@bar', '@', 'a@', '@b.com', 'a@b.1',
  'a..b@x.com', '.a@x.com', 'a.@x.com', 'a@b..com', 'a@.b.com', 'a@b.com.',
  'a b@x.com', 'a@@x.com', 'a@b_c.com', '', '   ', 'plainaddress', 'a@b-.com', 'a@-b.com'];
for (const e of reject) ok(`rejects ${JSON.stringify(e)}`, validateEmail(e).valid === false);

const accept = ['user@example.com', 'first.last@sub.domain.co.uk', 'name+tag@gmail.com',
  'x@y.io', 'maintainer@example.dev', 'a@b-c.com', 'UPPER@CASE.COM', '  pad@ded.com  '];
for (const e of accept) ok(`accepts ${JSON.stringify(e)}`, validateEmail(e).valid === true);

// every rejection carries a reason
ok('rejection has a reason', typeof validateEmail('m@m.m').reason === 'string');

console.log(failures === 0 ? '\nALL EMAIL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
