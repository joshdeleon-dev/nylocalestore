// Marketplace rules shared by the browser and the server: money math, labels,
// status transitions and request validation.

import { z } from 'zod';
import { ListingAction, ListingCondition, ListingStatus } from '@/types/marketplace';

// Must match the generated columns in migration 011:
//   locale_amount_cents = round(price * percent / 100), payout = price - locale_amount
export function calcLocaleSplit(priceCents: number, percent: number) {
  const basisPoints = Math.round(percent * 100); // 15.5% -> 1550
  const localeCents = Math.round((priceCents * basisPoints) / 10000);
  return { localeCents, payoutCents: priceCents - localeCents };
}

export const QUICK_PICK_PERCENTS = [5, 15, 20];

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
  sold: 'Sold',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  unpublished: 'Unpublished',
};

export const STATUS_BADGE: Record<ListingStatus, string> = {
  submitted: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  reserved: 'bg-blue-100 text-blue-800',
  sold: 'bg-coffee-200 text-coffee-800',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
  unpublished: 'bg-gray-100 text-gray-700',
};

// Which admin actions are allowed from each status (reserved/sold are handled in later phases)
export const ALLOWED_ACTIONS: Record<ListingStatus, ListingAction[]> = {
  submitted: ['publish', 'reject', 'withdraw'],
  published: ['unpublish', 'withdraw'],
  unpublished: ['publish', 'withdraw'],
  rejected: ['reopen'],
  withdrawn: ['reopen'],
  reserved: [],
  sold: [],
};

export const ACTION_RESULT: Record<ListingAction, ListingStatus> = {
  publish: 'published',
  unpublish: 'unpublished',
  reject: 'rejected',
  withdraw: 'withdrawn',
  reopen: 'submitted',
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

export const updateListingSchema = listingFieldsSchema.partial().extend({ seller: sellerSchema.partial().optional() });

export const listingActionSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'reject', 'withdraw', 'reopen']),
  reason: z.string().trim().max(1000).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const firstZodError = (err: z.ZodError) => err.issues[0]?.message ?? 'Invalid input';
