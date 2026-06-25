// Role-Based Access Control utilities

import { UserRole } from '@/types';

export type PermissionString = `${string}:${string}`;

// Define role permissions matrix
const rolePermissions: Record<UserRole, PermissionString[]> = {
  ADMIN: [
    'admin:full_access',
    'orders:view',
    'orders:create',
    'orders:update',
    'orders:cancel',
    'inventory:view',
    'inventory:adjust',
    'inventory:view_reports',
    'products:view',
    'products:create',
    'products:update',
    'products:delete',
    'modifiers:view',
    'modifiers:create',
    'modifiers:update',
    'modifiers:delete',
    'reports:view',
    'reports:create_custom',
    'reports:export',
    'users:manage',
    'sticker:print',
    'audit:view',
  ],
  MANAGER: [
    'orders:view',
    'orders:create',
    'orders:update',
    'orders:cancel',
    'inventory:view',
    'inventory:adjust',
    'inventory:view_reports',
    'products:view',
    'products:create',
    'products:update',
    'products:delete',
    'modifiers:view',
    'modifiers:create',
    'modifiers:update',
    'modifiers:delete',
    'reports:view',
    'reports:create_custom',
    'reports:export',
    'audit:view',
  ],
  BARISTA: [
    'orders:view',
    'orders:update',
    'modifiers:view',
    'modifiers:create',
    'modifiers:update',
    'modifiers:delete',
    'sticker:print',
    'audit:view',
  ],
  CASHIER: [
    'orders:view',
    'orders:update',
    'audit:view',
  ],
  CUSTOMER: [
    'orders:view',
    'orders:create',
  ],
};

// Route access control
export const routePermissions: Record<string, PermissionString[]> = {
  // Customer routes
  '/': ['orders:create'],
  '/order': ['orders:create'],
  '/confirmation': ['orders:view'],

  // Barista routes
  '/dashboard/barista': ['sticker:print', 'orders:update'],

  // Cashier routes
  '/dashboard/cashier': ['orders:update'],

  // Manager routes
  '/dashboard/manager': ['orders:view', 'inventory:view', 'products:view', 'reports:view'],
  '/dashboard/manager/products': ['products:view', 'products:create', 'products:update'],
  '/dashboard/manager/inventory': ['inventory:view', 'inventory:adjust'],
  '/dashboard/manager/reports': ['reports:view'],

  // Admin routes
  '/dashboard/admin': ['admin:full_access'],
  '/dashboard/admin/users': ['users:manage'],
  '/dashboard/admin/audit': ['audit:view'],
};

export const hasPermission = (
  role: UserRole,
  permission: PermissionString
): boolean => {
  const permissions = rolePermissions[role] || [];
  
  // Admin bypass
  if (permissions.includes('admin:full_access')) {
    return true;
  }
  
  return permissions.includes(permission);
};

export const hasAnyPermission = (
  role: UserRole,
  permissions: PermissionString[]
): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};

export const hasAllPermissions = (
  role: UserRole,
  permissions: PermissionString[]
): boolean => {
  return permissions.every(permission => hasPermission(role, permission));
};

export const canAccessRoute = (role: UserRole, route: string): boolean => {
  const requiredPermissions = routePermissions[route];
  
  if (!requiredPermissions) {
    // No specific permissions required for this route
    return true;
  }
  
  return hasAnyPermission(role, requiredPermissions);
};

export const getAccessibleRoutes = (role: UserRole): string[] => {
  return Object.entries(routePermissions)
    .filter(([_, permissions]) => hasAnyPermission(role, permissions))
    .map(([route]) => route);
};

export const getRolePermissions = (role: UserRole): PermissionString[] => {
  return rolePermissions[role] || [];
};

// API endpoint protection
export const apiEndpointPermissions: Record<string, PermissionString[]> = {
  'GET /api/orders': ['orders:view'],
  'POST /api/orders': ['orders:create'],
  'PUT /api/orders/:id': ['orders:update'],
  'DELETE /api/orders/:id': ['orders:cancel'],

  'GET /api/products': ['products:view'],
  'POST /api/products': ['products:create'],
  'PUT /api/products/:id': ['products:update'],
  'DELETE /api/products/:id': ['products:delete'],

  'GET /api/inventory': ['inventory:view'],
  'POST /api/inventory/adjust': ['inventory:adjust'],
  'GET /api/inventory/reports': ['inventory:view_reports'],

  'GET /api/reports': ['reports:view'],
  'POST /api/reports/custom': ['reports:create_custom'],
  'GET /api/reports/export': ['reports:export'],

  'GET /api/users': ['users:manage'],
  'POST /api/users': ['users:manage'],
  'PUT /api/users/:id': ['users:manage'],
  'DELETE /api/users/:id': ['users:manage'],

  'GET /api/audit-logs': ['audit:view'],

  'POST /api/sticker/print': ['sticker:print'],
};

export const canAccessEndpoint = (
  role: UserRole,
  method: string,
  endpoint: string
): boolean => {
  const endpointKey = `${method} ${endpoint}`;
  const permissions = apiEndpointPermissions[endpointKey];
  
  if (!permissions) {
    return true; // Public endpoint
  }
  
  return hasAnyPermission(role, permissions);
};
