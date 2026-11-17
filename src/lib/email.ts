// Transactional email via Resend (installed from the Vercel Marketplace, which sets RESEND_API_KEY).
// Server-only. Without a key, emails are logged and skipped so local dev and tests still work.

const DEFAULT_FROM = 'NY Locale Marketplace <marketplace@nylocalestore.com>';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  // Resend drops repeats with the same key for 24h, so a retried request can't double-send
  idempotencyKey?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`Email skipped (RESEND_API_KEY not set): "${msg.subject}"`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(msg.idempotencyKey ? { 'Idempotency-Key': msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.MARKETPLACE_EMAIL_FROM || DEFAULT_FROM,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        ...(process.env.MARKETPLACE_EMAIL_REPLY_TO ? { reply_to: process.env.MARKETPLACE_EMAIL_REPLY_TO } : {}),
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`Email failed (${res.status}): "${msg.subject}"`, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Email failed: "${msg.subject}"`, e);
    return false;
  }
}

// Staff who get an alert for each new submission and reservation (comma-separated in Vercel)
export const adminRecipients = () =>
  (process.env.MARKETPLACE_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean);

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
