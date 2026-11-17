// Fields for the marketplace pivot report. One row per item, with its seller, its buyer
// (the paying buyer, or whoever currently holds it) and its sale. Shared by the API and the browser.

import type { Dimension, Measure, PivotConfig } from '@/lib/pivot';

export interface ReportItem {
  listing_id: number;
  item: string;
  category: string;
  condition: string;
  status: string;
  flagship: string;
  archived: string;
  locale_percent: number;
  submitted_date: string; // YYYY-MM-DD, New York
  seller_name: string;
  seller_email: string;
  seller_phone: string;
  seller_group: string;
  seller_no_group_reason: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_group: string;
  buyer_no_group_reason: string;
  pickup: string;
  reservation_status: string;
  sold_date: string;
  seller_paid: string;
  seller_paid_date: string;
  asking_price_cents: number;
  sale_price_cents: number | null;
  locale_amount_cents: number;
  seller_payout_cents: number;
}

export type ReportBasis = 'sold' | 'all';

const month = (d: string) => d.slice(0, 7);

export const REPORT_DIMENSIONS: Dimension<ReportItem>[] = [
  { key: 'seller_group', label: 'Seller group', get: (r) => r.seller_group },
  { key: 'buyer_group', label: 'Buyer group', get: (r) => r.buyer_group },
  { key: 'category', label: 'Category', get: (r) => r.category },
  { key: 'condition', label: 'Condition', get: (r) => r.condition },
  { key: 'status', label: 'Status', get: (r) => r.status },
  { key: 'locale_percent', label: 'For Locale %', get: (r) => `${r.locale_percent}%` },
  { key: 'flagship', label: '100% for Flagship', get: (r) => r.flagship },
  { key: 'seller_paid', label: 'Seller paid', get: (r) => r.seller_paid },
  { key: 'reservation_status', label: 'Reservation status', get: (r) => r.reservation_status },
  { key: 'pickup', label: 'Pickup', get: (r) => r.pickup },
  { key: 'sold_month', label: 'Sold month', get: (r) => month(r.sold_date) },
  { key: 'sold_date', label: 'Sold date', get: (r) => r.sold_date },
  { key: 'submitted_month', label: 'Submitted month', get: (r) => month(r.submitted_date) },
  { key: 'submitted_date', label: 'Submitted date', get: (r) => r.submitted_date },
  { key: 'seller_paid_date', label: 'Seller paid date', get: (r) => r.seller_paid_date },
  { key: 'seller_name', label: 'Seller name', get: (r) => r.seller_name },
  { key: 'seller_email', label: 'Seller email', get: (r) => r.seller_email },
  { key: 'seller_phone', label: 'Seller phone', get: (r) => r.seller_phone },
  { key: 'seller_no_group_reason', label: 'Seller no-group reason', get: (r) => r.seller_no_group_reason },
  { key: 'buyer_name', label: 'Buyer name', get: (r) => r.buyer_name },
  { key: 'buyer_email', label: 'Buyer email', get: (r) => r.buyer_email },
  { key: 'buyer_phone', label: 'Buyer phone', get: (r) => r.buyer_phone },
  { key: 'buyer_no_group_reason', label: 'Buyer no-group reason', get: (r) => r.buyer_no_group_reason },
  { key: 'item', label: 'Item', get: (r) => r.item },
  { key: 'archived', label: 'Archived', get: (r) => r.archived },
];

export const REPORT_MEASURES: Measure<ReportItem>[] = [
  { key: 'items', label: 'Items', format: 'number', get: () => 1, countOnly: true },
  { key: 'sale_price', label: 'Sale price', format: 'money', get: (r) => r.sale_price_cents },
  { key: 'asking_price', label: 'Asking price', format: 'money', get: (r) => r.asking_price_cents },
  { key: 'locale_amount', label: 'For Locale', format: 'money', get: (r) => r.locale_amount_cents },
  { key: 'seller_payout', label: 'Seller payout', format: 'money', get: (r) => r.seller_payout_cents },
  { key: 'locale_percent', label: 'For Locale %', format: 'percent', get: (r) => r.locale_percent },
];

export const DEFAULT_PIVOT: PivotConfig = {
  rows: ['seller_group'],
  col: null,
  values: [
    { measure: 'items', agg: 'count' },
    { measure: 'sale_price', agg: 'sum' },
    { measure: 'locale_amount', agg: 'sum' },
    { measure: 'seller_payout', agg: 'sum' },
  ],
  filters: [],
};

// "Details" CSV: every field, one row per item
export function detailRows(items: ReportItem[]): (string | number)[][] {
  const money = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2));
  const header = [
    'Listing ID', 'Item', 'Category', 'Condition', 'Status', '100% for Flagship', 'Archived', 'Submitted date',
    'Seller name', 'Seller email', 'Seller phone', 'Seller group', 'Seller no-group reason',
    'Buyer name', 'Buyer email', 'Buyer phone', 'Buyer group', 'Buyer no-group reason', 'Pickup', 'Reservation status',
    'Asking price', 'Sale price', 'For Locale %', 'For Locale', 'Seller payout', 'Sold date', 'Seller paid', 'Seller paid date',
  ];
  return [header, ...items.map((r) => [
    r.listing_id, r.item, r.category, r.condition, r.status, r.flagship, r.archived, r.submitted_date,
    r.seller_name, r.seller_email, r.seller_phone, r.seller_group, r.seller_no_group_reason,
    r.buyer_name, r.buyer_email, r.buyer_phone, r.buyer_group, r.buyer_no_group_reason, r.pickup, r.reservation_status,
    money(r.asking_price_cents), money(r.sale_price_cents), r.locale_percent, money(r.locale_amount_cents), money(r.seller_payout_cents),
    r.sold_date, r.seller_paid, r.seller_paid_date,
  ])];
}
