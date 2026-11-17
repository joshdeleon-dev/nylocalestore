// Marketplace confirmation emails. Inline styles only — email clients ignore stylesheets.

import { EmailMessage, escapeHtml } from '@/lib/email';
import { formatCents, groupLabel } from '@/lib/marketplace';

const C = { ink: '#2b1d14', muted: '#7a6352', line: '#eadfd6', bg: '#f7f1ec' };

function layout(heading: string, intro: string, rows: [string, string][], button: { label: string; url: string }, footer: string) {
  const rowHtml = rows
    .map(([k, v]) => `<tr><td style="padding:8px 0;color:${C.muted};font-size:14px">${escapeHtml(k)}</td><td style="padding:8px 0;color:${C.ink};font-size:14px;font-weight:600;text-align:right">${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${C.line};border-radius:16px">
<tr><td style="padding:28px 28px 0">
  <p style="margin:0;font-family:Georgia,serif;font-size:18px;color:${C.ink}">New York Locale</p>
  <p style="margin:2px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};font-weight:600">Marketplace</p>
</td></tr>
<tr><td style="padding:24px 28px 8px">
  <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:26px;color:${C.ink}">${escapeHtml(heading)}</h1>
  <p style="margin:0;font-size:15px;line-height:1.55;color:${C.ink}">${escapeHtml(intro)}</p>
</td></tr>
<tr><td style="padding:12px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rowHtml}</table></td></tr>
<tr><td style="padding:16px 28px 8px">
  <a href="${escapeHtml(button.url)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:999px">${escapeHtml(button.label)}</a>
</td></tr>
<tr><td style="padding:8px 28px 28px"><p style="margin:0;font-size:13px;line-height:1.5;color:${C.muted}">${escapeHtml(footer)}</p></td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:${C.muted}">NY Locale Store · New York</p>
</td></tr></table></body></html>`;
}

const plain = (heading: string, intro: string, rows: [string, string][], button: { label: string; url: string }, footer: string) =>
  [heading, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `${button.label}: ${button.url}`, '', footer, '', 'NY Locale Store · New York'].join('\n');

function build(to: string | string[], subject: string, key: string, heading: string, intro: string, rows: [string, string][], button: { label: string; url: string }, footer: string): EmailMessage {
  return { to, subject, idempotencyKey: key, html: layout(heading, intro, rows, button, footer), text: plain(heading, intro, rows, button, footer) };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function sellerSubmissionEmail(p: {
  to: string; name: string; reference: number; title: string;
  priceCents: number; percent: number; localeCents: number; payoutCents: number;
  group: number | null; noGroupReason: string | null; trackUrl: string;
}) {
  return build(
    p.to,
    `We received your item: ${p.title} (#${p.reference})`,
    `mp-seller-submitted-${p.reference}`,
    `Thanks, ${firstName(p.name)}!`,
    'We’ve received your item and our team will review it soon. Use the link below any time to see whether it’s been approved, sold, and when you’ve been paid.',
    [
      ['Reference', `#${p.reference}`],
      ['Item', p.title],
      ['Your price', formatCents(p.priceCents)],
      [`For Locale (${p.percent}%)`, formatCents(p.localeCents)],
      ['You’ll receive', formatCents(p.payoutCents)],
      ['Group', groupLabel(p.group, p.noGroupReason)],
    ],
    { label: 'Track your item', url: p.trackUrl },
    'Keep this email — the link is private to you. Contact us at the Locale if anything looks wrong.',
  );
}

// ── Staff alerts ─────────────────────────────────────────────────────────────

export function adminSubmissionEmail(p: {
  to: string[]; reference: number; title: string; priceCents: number; percent: number;
  sellerName: string; sellerEmail: string; sellerPhone: string;
  group: number | null; noGroupReason: string | null; photoCount: number; dashboardUrl: string;
}) {
  return build(
    p.to,
    `New item to review: ${p.title} — ${formatCents(p.priceCents)} (#${p.reference})`,
    `mp-admin-submitted-${p.reference}`,
    'New item submitted',
    `${p.sellerName} submitted an item for the marketplace. It’s waiting for review.`,
    [
      ['Reference', `#${p.reference}`],
      ['Item', p.title],
      ['Price', formatCents(p.priceCents)],
      ['For Locale', `${p.percent}%`],
      ['Photos', String(p.photoCount)],
      ['Seller', p.sellerName],
      ['Email', p.sellerEmail],
      ['Phone', p.sellerPhone],
      ['Group', groupLabel(p.group, p.noGroupReason) + (p.noGroupReason ? ` (${p.noGroupReason})` : '')],
    ],
    { label: 'Review in dashboard', url: p.dashboardUrl },
    'You’re getting this because your address is in MARKETPLACE_ADMIN_EMAILS.',
  );
}

export function adminReservationEmail(p: {
  to: string[]; reservationId: number; title: string; priceCents: number;
  buyerName: string; buyerEmail: string; buyerPhone: string; pickup: string;
  group: number | null; noGroupReason: string | null; dashboardUrl: string;
}) {
  return build(
    p.to,
    `New reservation: ${p.title} — ${formatCents(p.priceCents)} (${p.buyerName})`,
    `mp-admin-reserved-${p.reservationId}`,
    'Item reserved',
    `${p.buyerName} reserved an item. Contact them to arrange pickup.`,
    [
      ['Reservation', `#${p.reservationId}`],
      ['Item', p.title],
      ['Price', formatCents(p.priceCents)],
      ['Buyer', p.buyerName],
      ['Email', p.buyerEmail],
      ['Phone', p.buyerPhone],
      ['Pickup', p.pickup],
      ['Group', groupLabel(p.group, p.noGroupReason) + (p.noGroupReason ? ` (${p.noGroupReason})` : '')],
    ],
    { label: 'Open reservations', url: p.dashboardUrl },
    'You’re getting this because your address is in MARKETPLACE_ADMIN_EMAILS.',
  );
}

export function buyerReservationEmail(p: {
  to: string; name: string; reservationId: number; title: string; priceCents: number;
  pickup: string; group: number | null; noGroupReason: string | null; reservationUrl: string;
}) {
  return build(
    p.to,
    `Reservation confirmed: ${p.title} — ${formatCents(p.priceCents)}`,
    `mp-buyer-reserved-${p.reservationId}`,
    `You’ve reserved it, ${firstName(p.name)}!`,
    'We’re holding this item for you. Our team will contact you to arrange pickup — you pay at pickup, after you’ve seen the item.',
    [
      ['Reservation', `#${p.reservationId}`],
      ['Item', p.title],
      ['Price', formatCents(p.priceCents)],
      ['Pickup', p.pickup],
      ['Group', groupLabel(p.group, p.noGroupReason)],
    ],
    { label: 'View or cancel your reservation', url: p.reservationUrl },
    'Keep this email — the link is private to you and lets you check on or cancel this reservation.',
  );
}
