// Utility functions

import { UserRole, OrderStatus } from '@/types';

const ET = 'America/New_York';

// Current date in Eastern time as YYYY-MM-DD — usable in both browser and server
export const easternToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ET }).format(new Date());

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatDate = (date: string | Date): string => {
  // Date-only strings (YYYY-MM-DD) represent the Eastern business date already.
  // new Date('YYYY-MM-DD') parses as UTC midnight which shifts Eastern back a day.
  // Parse components directly to display the correct date.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: ET,
    }).format(new Date(y, m - 1, d));
  }
  // Full ISO timestamps: convert from UTC to Eastern
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: ET,
  }).format(new Date(date));
};

export const formatDateTime = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ET,
  }).format(new Date(date));
};

export const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

export const generateOrderNumber = (): string => {
  // Use Eastern date so order numbers reflect the NY business day, not UTC
  const easternDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date()); // → "YYYY-MM-DD"
  const datePart = easternDate.replace(/-/g, '');
  const random = String(Date.now() % 10000).padStart(4, '0');
  return `ORD-${datePart}-${random}`;
};

export const getOrderStatusColor = (status: OrderStatus): string => {
  const colors: Record<OrderStatus, string> = {
    NEW: 'bg-blue-100 text-blue-800',
    ACCEPTED: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-purple-100 text-purple-800',
    READY: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getOrderStatusLabel = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
    NEW: 'New',
    ACCEPTED: 'Accepted',
    IN_PROGRESS: 'In Progress',
    READY: 'Ready',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return labels[status] || status;
};

export const canTransitionOrderStatus = (
  from: OrderStatus,
  to: OrderStatus
): boolean => {
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    NEW: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['READY', 'CANCELLED'],
    READY: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  return transitions[from]?.includes(to) || false;
};

export const getRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    ADMIN: 'Administrator',
    MANAGER: 'Manager',
    BARISTA: 'Barista',
    CASHIER: 'Cashier',
    CUSTOMER: 'Customer',
    GROUP_LEADER: 'Group Leader',
  };
  return labels[role] || role;
};

export const parseJSONSafely = (json: string): any => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const calculateTax = (subtotal: number, taxRate: number): number => {
  return Math.round(subtotal * taxRate * 100) / 100;
};

export const calculateTotal = (
  subtotal: number,
  tax: number
): number => {
  return Math.round((subtotal + tax) * 100) / 100;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhoneNumber = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
};
