// Core business logic types

export type UserRole = 'ADMIN' | 'MANAGER' | 'BARISTA' | 'CASHIER' | 'CUSTOMER';

export type OrderStatus = 
  | 'NEW' 
  | 'ACCEPTED' 
  | 'IN_PROGRESS' 
  | 'READY' 
  | 'COMPLETED' 
  | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE';

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';

export type StoreStatus = 'open' | 'closed';

// Entities

export interface Role {
  id: number;
  name: UserRole;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role_id: number;
  location_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  phone?: string;
  is_active: boolean;
  store_status: StoreStatus;
  ordering_status: boolean;
  tax_rate: number;
  estimated_wait_time: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  category_id: number;
  base_price: number;
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
  current_stock?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: number;
  title: string;
  body?: string;
  type: 'info' | 'warning' | 'promotion' | 'event';
  is_active: boolean;
  display_order: number;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface HeroSlide {
  id: number;
  title?: string;
  subtitle?: string;
  cta_text: string;
  cta_href: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedReport {
  id: number;
  name: string;
  source: 'orders' | 'inventory';
  fields: string[];
  filters: Record<string, string>;
  created_by?: string;
  created_at: string;
}

export interface Modifier {
  id: number;
  modifier_group_id: number;
  name: string;
  price_adjustment: number;
  display_order: number;
  created_at: string;
}

export interface ModifierGroup {
  id: number;
  name: string;
  display_order: number;
  is_required: boolean;
  min_selection: number;
  max_selection?: number;
  created_at: string;
  updated_at: string;
  modifiers?: Modifier[];
}

export interface ProductModifierGroup {
  id: number;
  product_id: number;
  modifier_group_id: number;
  display_order: number;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  updated_at: string;
  product?: Product;
  modifiers?: OrderItemModifier[];
}

export interface OrderItemModifier {
  id: number;
  order_item_id: number;
  modifier_id: number;
  name: string;
  price_adjustment: number;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  group_number: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  order_date: string;
  sales_date: string;
  completed_date?: string;
  cancelled_date?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface Inventory {
  id: number;
  product_id: number;
  location_id: number;
  current_stock: number;
  low_stock_threshold: number;
  unit_of_measure: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryLog {
  id: number;
  product_id: number;
  location_id: number;
  quantity_change: number;
  adjustment_reason?: string;
  reference_type?: string;
  reference_id?: string;
  previous_stock?: number;
  new_stock?: number;
  created_by?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Setting {
  id: number;
  location_id: number;
  key: string;
  value: string;
  data_type: string;
  created_at: string;
  updated_at: string;
}

// Cart and Checkout

export interface CartItemModifier {
  id: number;
  name: string;
  price_adjustment: number;
}

export interface CartItem {
  id: string;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  modifiers: CartItemModifier[];
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface CheckoutData {
  customer_name: string;
  customer_phone: string;
  group_number: number;
  notes?: string;
  payment_method: PaymentMethod;
}

// API Responses

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Reports

export interface SalesReportMetrics {
  revenue: number;
  orders: number;
  completed_orders: number;
  cancelled_orders: number;
  average_ticket: number;
  average_items_per_order: number;
  top_selling_products: { product_name: string; quantity: number }[];
  sales_by_hour: { hour: number; revenue: number }[];
}

export interface CustomReportFilter {
  date_range?: { start: string; end: string };
  order_date?: { start: string; end: string };
  customer_name?: string;
  group_number?: number;
  product_id?: number;
  category_id?: number;
  status?: OrderStatus;
  payment_status?: PaymentStatus;
}

export interface CustomReportColumn {
  field: string;
  label: string;
  type: string;
}

export interface ReportExport {
  format: 'csv' | 'xlsx';
  filename: string;
  data: any[];
}
