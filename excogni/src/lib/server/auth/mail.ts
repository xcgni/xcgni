// Magic-link email delivery.
//
// In production set SMTP_* env vars and email is sent via nodemailer. If SMTP is
// not configured, we fall back to logging the link to stdout (and, where the dev
// flag is on, the login page also shows it) so local development needs no mail
// server. This means the app runs identically with or without email configured -
// it just can't deliver real mail until SMTP_HOST is set.
import { log } from '$lib/server/log';
import { emailHint } from '$lib/server/auth/email-index';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return {
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'Excogni <no-reply@excogni.local>'
  };
}

let transporterPromise: Promise<unknown> | null = null;

async function getTransporter(cfg: SmtpConfig): Promise<{ sendMail: (o: Record<string, unknown>) => Promise<unknown> } | null> {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      try {
        // dynamic import so the dependency is only needed when SMTP is configured
        const mod = await import('nodemailer');
        const nodemailer = (mod as { default?: unknown }).default ?? mod;
        // @ts-expect-error - nodemailer types are not bundled in this checkout
        return nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          // Force IPv4: providers often trust only the known v4 address, and a host
          // resolving to v6 after a restart shows up as an "unauthorized IP" (525).
          family: 4,
          // EHLO identity: without this, nodemailer announces the CONTAINER's hostname,
          // which resolves to a private 10.x address - a textbook spam signature that
          // providers reject and log as an "unauthorized IP". Announce the real domain.
          name: 'xcgni.com',
          auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined
        });
      } catch (e) {
        log.error('mail.transport_init_failed', { reason: e instanceof Error ? e.message : 'unknown' });
        return null;
      }
    })();
  }
  return transporterPromise as Promise<{ sendMail: (o: Record<string, unknown>) => Promise<unknown> } | null>;
}

function magicLinkHtml(link: string): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0A0C10;color:#E8EAED;border:1px solid #202733;border-radius:8px">
    <p style="font-family:monospace;letter-spacing:0.25em;color:#E2A33B;margin:0 0 16px">EXCOGNI</p>
    <p style="margin:0 0 16px;line-height:1.6">Here's your sign-in link. It expires shortly and can be used once.</p>
    <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#E2A33B;color:#0A0C10;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Sign in</a></p>
    <p style="margin:0;font-size:12px;color:#8C95A3;line-height:1.6">If you didn't request this, you can ignore this email. The link won't sign anyone in without being clicked.</p>
  </div>`;
}

export async function sendMagicLinkEmail(email: string, link: string): Promise<void> {
  const cfg = smtpConfig();
  if (!cfg) {
    // no SMTP configured - dev fallback
    log.info('mail.stub', { email });
    console.log(`[mail stub] magic link for ${email}: ${link}`);
    return;
  }
  const transporter = await getTransporter(cfg);
  if (!transporter) {
    log.error('mail.no_transporter', { email });
    console.log(`[mail fallback] magic link for ${email}: ${link}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: cfg.from,
      to: email,
      subject: 'Your Excogni sign-in link',
      text: `Sign in to Excogni: ${link}\n\nThis link expires shortly and can be used once. If you didn't request it, ignore this email.`,
      html: magicLinkHtml(link)
    });
    log.info('mail.sent', { email });
  } catch (e) {
    log.error('mail.send_failed', { email: emailHint(email), reason: e instanceof Error ? e.message : 'unknown' });
    // surface to console so the operator can recover the link if needed
    // Operator fallback: with mail down this log line is the only delivery path for the
    // link (short-lived, single-use). The address itself stays masked - logs are data too.
    console.log(`[mail send failed] magic link for ${emailHint(email)}: ${link}`);
    throw new Error('Could not send sign-in email. Please try again.');
  }
}
