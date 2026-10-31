// Marketplace rules shared by the browser and the server: money math, labels,
// status transitions and request validation.

import { z } from 'zod';
import { ListingAction, ListingCondition, ListingStatus, ReservationAction, ReservationStatus } from '@/types/marketplace';

// Must match the generated columns in migration 011:
//   locale_amount_cents = round(price * percent / 100), payout = price - locale_amount
export function calcLocaleSplit(priceCents: number, percent: number) {
  const basisPoints = Math.round(percent * 100); // 15.5% -> 1550
  const localeCents = Math.round((priceCents * basisPoints) / 10000);
  return { localeCents, payoutCents: priceCents - localeCents };
}

export const QUICK_PICK_PERCENTS = [30, 50, 100];

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  submitted: 'Submitted',
  published: 'Published',
  reserved: 'Reserved',
  paid: 'Buyer paid',
  sold: 'Sold',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  unpublished: 'Unpublished',
};

export const STATUS_BADGE: Record<ListingStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  reserved: 'bg-blue-100 text-blue-800',
  paid: 'bg-purple-100 text-purple-800',
  sold: 'bg-coffee-200 text-coffee-800',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
  unpublished: 'bg-gray-100 text-gray-700',
};

// Which admin actions are allowed from each status. Reserved items are normally released from the
// Reservations tab; 'release' covers a completed pickup where the buyer never paid.
export const ALLOWED_ACTIONS: Record<ListingStatus, ListingAction[]> = {
  submitted: ['publish', 'reject', 'withdraw'],
  published: ['unpublish', 'withdraw'],
  unpublished: ['publish', 'withdraw'],
  rejected: ['reopen'],
  withdrawn: ['reopen'],
  reserved: ['release'],
  paid: [],
  sold: [],
};

export const ACTION_RESULT: Record<ListingAction, ListingStatus> = {
  publish: 'published',
  unpublish: 'unpublished',
  reject: 'rejected',
  withdraw: 'withdrawn',
  reopen: 'submitted',
  release: 'published',
};

export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const slugify = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

// ── Request validation ───────────────────────────────────────────────────────

const percent = z.coerce.number().min(0, 'Donation can’t be negative').max(100, 'Donation can’t exceed 100%')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Use at most 2 decimal places');

const priceCents = z.coerce.number().int('Price must be in whole cents').min(0, 'Price can’t be negative').max(100_000_000);

export const sellerSchema = z.object({
  name: z.string().trim().min(1, 'Seller name is required').max(120),
  email: z.string().trim().email('Valid seller email is required').max(200),
  phone: z.string().trim().min(7, 'Seller phone is required').max(40),
});

export const listingFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().max(5000).default(''),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  asking_price_cents: priceCents,
  locale_percent: percent,
  admin_notes: z.string().trim().max(2000).nullable().optional(),
});

export const createListingSchema = listingFieldsSchema.extend({ seller: sellerSchema });

// Public "Sell an item" form: no admin fields, at least one photo, explicit consent
export const publicSubmissionSchema = listingFieldsSchema.omit({ admin_notes: true }).extend({
  asking_price_cents: priceCents.min(1, 'Enter a price'),
  // Sellers pick a quick option or no donation; only admins can set other percentages
  locale_percent: percent.refine((n) => n === 0 || QUICK_PICK_PERCENTS.includes(n), 'Choose 30%, 50% or 100%, or no donation'),
  seller: sellerSchema,
  paths: z.array(z.string()).min(1, 'Add at least one photo').max(10, 'At most 10 photos'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm the agreement to continue' }) }),
});

export const updateListingSchema = listingFieldsSchema.partial().extend({ seller: sellerSchema.partial().optional() });

export const listingActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'reject', 'withdraw', 'reopen', 'release']),
  reason: z.string().trim().max(1000).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const firstZodError = (err: z.ZodError) => err.issues[0]?.message ?? 'Invalid input';

// ── Reservations ─────────────────────────────────────────────────────────────

export const MAX_OPEN_RESERVATIONS = 3;

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  completed: 'Completed',
  canceled: 'Canceled',
  no_show: 'No-show',
};

export const RESERVATION_STATUS_BADGE: Record<ReservationStatus, string> = {
  requested: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  canceled: 'bg-gray-100 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
};

export const OPEN_RESERVATION_STATUSES: ReservationStatus[] = ['requested', 'confirmed'];

// Admin actions allowed from each status (mirrors marketplace_update_reservation in migration 012)
export const RESERVATION_ACTIONS: Record<ReservationStatus, ReservationAction[]> = {
  requested: ['confirm', 'complete', 'cancel', 'no_show'],
  confirmed: ['complete', 'cancel', 'no_show'],
  completed: [],
  canceled: [],
  no_show: [],
};

export const RESERVATION_ACTION_RESULT: Record<ReservationAction, ReservationStatus> = {
  confirm: 'confirmed',
  complete: 'completed',
  cancel: 'canceled',
  no_show: 'no_show',
};

// Used for the per-buyer limit: case-insensitive email, digits-only US phone
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

export const reservationSchema = z
  .object({
    slug: z.string().min(1),
    buyer_name: z.string().trim().min(1, 'Your name is required').max(120),
    buyer_email: z.string().trim().email('Enter a valid email').max(200),
    buyer_phone: z.string().trim().max(40).refine((p) => normalizePhone(p).length >= 10, 'Enter a valid phone number'),
    pickup_type: z.enum(['locale', 'other']),
    pickup_street: z.string().trim().max(200).optional(),
    pickup_unit: z.string().trim().max(50).optional(),
    pickup_city: z.string().trim().max(100).optional(),
    pickup_state: z.string().trim().max(50).optional(),
    pickup_zip: z.string().trim().max(10).optional(),
  })
  .superRefine((r, ctx) => {
    if (r.pickup_type !== 'other') return;
    if (!r.pickup_street) ctx.addIssue({ code: 'custom', message: 'Street address is required', path: ['pickup_street'] });
    if (!r.pickup_city) ctx.addIssue({ code: 'custom', message: 'City is required', path: ['pickup_city'] });
    if (!r.pickup_state) ctx.addIssue({ code: 'custom', message: 'State is required', path: ['pickup_state'] });
    if (!r.pickup_zip || !/^\d{5}(-\d{4})?$/.test(r.pickup_zip)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid ZIP code', path: ['pickup_zip'] });
    }
  });

export const reservationActionSchema = z.object({
  action: z.enum(['confirm', 'complete', 'cancel', 'no_show']).optional(),
  reason: z.string().trim().max(1000).optional(),
  admin_notes: z.string().trim().max(2000).nullable().optional(),
});

export function formatPickup(r: { pickup_type: string; pickup_street?: string | null; pickup_unit?: string | null; pickup_city?: string | null; pickup_state?: string | null; pickup_zip?: string | null }) {
  if (r.pickup_type === 'locale') return 'Pickup at the Locale';
  const line1 = [r.pickup_street, r.pickup_unit].filter(Boolean).join(', ');
  const line2 = [r.pickup_city, [r.pickup_state, r.pickup_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [line1, line2].filter(Boolean).join(' · ');
}
