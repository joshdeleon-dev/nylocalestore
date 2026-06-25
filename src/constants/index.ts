// Application constants

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  BARISTA: 'BARISTA',
  CASHIER: 'CASHIER',
  CUSTOMER: 'CUSTOMER',
} as const;

export const ORDER_STATUSES = {
  NEW: 'NEW',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  MOBILE: 'MOBILE',
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export const STORE_STATUSES = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export const MODIFIERS = {
  SIZE_SMALL: { id: 1, name: 'Small', price_adjustment: 0 },
  SIZE_MEDIUM: { id: 2, name: 'Medium', price_adjustment: 0.5 },
  SIZE_LARGE: { id: 3, name: 'Large', price_adjustment: 1 },
  MILK_WHOLE: { id: 4, name: 'Whole Milk', price_adjustment: 0 },
  MILK_OAT: { id: 5, name: 'Oat Milk', price_adjustment: 0.75 },
  MILK_ALMOND: { id: 6, name: 'Almond Milk', price_adjustment: 0.75 },
  MILK_COCONUT: { id: 7, name: 'Coconut Milk', price_adjustment: 0.75 },
  MILK_SOY: { id: 8, name: 'Soy Milk', price_adjustment: 0.5 },
  ADDON_EXTRA_SHOT: { id: 9, name: 'Extra Shot', price_adjustment: 0.75 },
  ADDON_VANILLA: { id: 10, name: 'Vanilla Syrup', price_adjustment: 0.5 },
  ADDON_CARAMEL: { id: 11, name: 'Caramel Syrup', price_adjustment: 0.5 },
  ADDON_HAZELNUT: { id: 12, name: 'Hazelnut Syrup', price_adjustment: 0.5 },
  ADDON_HONEY: { id: 13, name: 'Honey', price_adjustment: 0.5 },
  ADDON_CINNAMON: { id: 14, name: 'Cinnamon', price_adjustment: 0.25 },
  ADDON_WHIPPED_CREAM: { id: 15, name: 'Whipped Cream', price_adjustment: 0.75 },
} as const;

export const DEFAULT_TAX_RATE = 0;
export const DEFAULT_ESTIMATED_WAIT_TIME = 15; // minutes

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  DEFAULT_OFFSET: 0,
} as const;

export const REPORT_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  CUSTOM: 'custom',
} as const;

export const EXPORT_FORMATS = {
  CSV: 'csv',
  XLSX: 'xlsx',
  PDF: 'pdf',
} as const;

export const INVENTORY_ADJUSTMENT_REASONS = [
  'Damage',
  'Expiration',
  'Recount',
  'Order completed',
  'Manual adjustment',
  'Loss',
  'Spillage',
  'Other',
] as const;

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PRINT: 'PRINT',
  EXPORT: 'EXPORT',
} as const;

export const DASHBOARD_ROUTES = {
  BARISTA: '/dashboard/barista',
  CASHIER: '/dashboard/cashier',
  MANAGER: '/dashboard/manager',
  ADMIN: '/dashboard/admin',
} as const;

// Route protection
export const PUBLIC_ROUTES = [
  '/',
  '/product',
  '/cart',
  '/checkout',
  '/confirmation',
  '/order-status',
] as const;

export const PROTECTED_ROUTES = [
  '/dashboard/barista',
  '/dashboard/cashier',
  '/dashboard/manager',
  '/dashboard/admin',
] as const;

// Validation
export const VALIDATION = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 15,
  MIN_GROUP_NUMBER: 1,
  MAX_GROUP_NUMBER: 999,
} as const;
