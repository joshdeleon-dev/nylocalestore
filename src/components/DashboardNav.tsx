'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Coffee,
  LayoutDashboard,
  ShoppingBag,
  Package,
  BarChart2,
  Users,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Archive,
  Clock,
  CreditCard,
  Sliders,
  Megaphone,
  Tag,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const adminNav: NavItem[] = [
  { label: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'Orders', href: '/dashboard/admin/orders', icon: ShoppingBag },
  { label: 'Products', href: '/dashboard/admin/products', icon: Package },
  { label: 'Inventory', href: '/dashboard/admin/inventory', icon: Archive },
  { label: 'Users', href: '/dashboard/admin/users', icon: Users },
  { label: 'Modifiers', href: '/dashboard/admin/modifiers', icon: Sliders },
  { label: 'Roles', href: '/dashboard/admin/roles', icon: Shield },
  { label: 'Announcements', href: '/dashboard/admin/announcements', icon: Megaphone },
  { label: 'Order Tickets', href: '/dashboard/admin/order-tickets', icon: Tag },
  { label: 'Reports', href: '/dashboard/admin/reports', icon: BarChart2 },
  { label: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
];

const managerNav: NavItem[] = [
  { label: 'Overview', href: '/dashboard/manager', icon: LayoutDashboard },
  { label: 'Orders', href: '/dashboard/manager/orders', icon: ShoppingBag },
  { label: 'Products', href: '/dashboard/manager/products', icon: Package },
  { label: 'Modifiers', href: '/dashboard/manager/modifiers', icon: Sliders },
  { label: 'Inventory', href: '/dashboard/manager/inventory', icon: Archive },
  { label: 'Announcements', href: '/dashboard/manager/announcements', icon: Megaphone },
  { label: 'Order Tickets', href: '/dashboard/manager/order-tickets', icon: Tag },
  { label: 'Reports', href: '/dashboard/manager/reports', icon: BarChart2 },
];

const baristaNav: NavItem[] = [
  { label: 'Order Queue', href: '/dashboard/barista', icon: Clock },
];

const cashierNav: NavItem[] = [
  { label: 'Cashier', href: '/dashboard/cashier', icon: CreditCard },
];

export function DashboardNav() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems =
    user?.role === 'ADMIN'
      ? adminNav
      : user?.role === 'MANAGER'
      ? managerNav
      : user?.role === 'BARISTA'
      ? baristaNav
      : user?.role === 'CASHIER'
      ? cashierNav
      : [];

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrator',
    MANAGER: 'Manager',
    BARISTA: 'Barista',
    CASHIER: 'Cashier',
  };

  const sidebarInner = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-coffee-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">NY Locale Store</p>
            <p className="text-coffee-300 text-xs">{user ? roleLabel[user.role] : 'Dashboard'}</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-coffee-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User Info + Sign Out */}
      <div className="px-3 py-4 border-t border-coffee-600">
        {user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{user.full_name}</p>
            <p className="text-coffee-300 text-xs truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-coffee-200 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 bg-coffee-800 flex-shrink-0">
        {sidebarInner}
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-coffee-800 border-b border-coffee-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-sm">NY Locale Store</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1 rounded-lg hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-coffee-800 h-full shadow-xl flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}
    </>
  );
}
