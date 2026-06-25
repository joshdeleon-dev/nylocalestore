'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { Shield, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLE_ORDER: UserRole[] = ['ADMIN', 'MANAGER', 'BARISTA', 'CASHIER', 'CUSTOMER'];

const ALL_PERMISSIONS: { resource: string; label: string; actions: { key: string; label: string }[] }[] = [
  {
    resource: 'orders', label: 'Orders',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'update', label: 'Update Status' },
      { key: 'cancel', label: 'Cancel' },
    ],
  },
  {
    resource: 'products', label: 'Products',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'update', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    resource: 'modifiers', label: 'Modifiers',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'update', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    resource: 'inventory', label: 'Inventory',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'adjust', label: 'Adjust Stock' },
      { key: 'view_reports', label: 'View Reports' },
    ],
  },
  {
    resource: 'reports', label: 'Reports',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create_custom', label: 'Custom Reports' },
      { key: 'export', label: 'Export' },
    ],
  },
  {
    resource: 'users', label: 'Users',
    actions: [{ key: 'manage', label: 'Manage' }],
  },
  {
    resource: 'sticker', label: 'Sticker',
    actions: [{ key: 'print', label: 'Print Stickers' }],
  },
  {
    resource: 'audit', label: 'Audit',
    actions: [{ key: 'view', label: 'View Logs' }],
  },
];

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800 border-red-200',
  MANAGER: 'bg-purple-100 text-purple-800 border-purple-200',
  BARISTA: 'bg-blue-100 text-blue-800 border-blue-200',
  CASHIER: 'bg-green-100 text-green-800 border-green-200',
  CUSTOMER: 'bg-gray-100 text-gray-800 border-gray-200',
};

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Full system access — all permissions always granted.',
  MANAGER: 'Manages products, modifiers, inventory, orders, and reports.',
  BARISTA: 'Manages order queue, modifiers, and prints cup stickers.',
  CASHIER: 'Views orders and updates payment/completion status.',
  CUSTOMER: 'Browses the menu and places orders.',
};

interface DBRole { id: number; name: string; }
interface DBPermission { id: number; name: string; resource: string; action: string; }
interface Assignment { role_id: number; permission_id: number; }

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function AdminRolesPage() {
  const [selected, setSelected] = useState<string>('MANAGER');
  const [roles, setRoles] = useState<DBRole[]>([]);
  const [permissions, setPermissions] = useState<DBPermission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRoles(json.roles || []);
      setPermissions(json.permissions || []);
      setAssignments(json.assignments || []);
    } catch (err: any) {
      toast.error('Failed to load permissions: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build lookup maps
  const roleByName: Record<string, DBRole> = {};
  roles.forEach((r) => { roleByName[r.name] = r; });

  const permByName: Record<string, DBPermission> = {};
  permissions.forEach((p) => { permByName[p.name] = p; });

  // Assignment set: "role_id:permission_id"
  const assignmentSet = new Set(assignments.map((a) => `${a.role_id}:${a.permission_id}`));

  const selectedRole = roleByName[selected];
  const isAdmin = selected === 'ADMIN';

  const hasPermission = (resource: string, action: string) => {
    if (isAdmin) return true;
    if (!selectedRole) return false;
    const perm = permByName[`${resource}:${action}`];
    if (!perm) return false;
    return assignmentSet.has(`${selectedRole.id}:${perm.id}`);
  };

  const getPermCount = (roleName: string) => {
    if (roleName === 'ADMIN') return '∞';
    const role = roleByName[roleName];
    if (!role) return 0;
    return assignments.filter((a) => a.role_id === role.id).length;
  };

  const togglePermission = async (resource: string, action: string) => {
    if (isAdmin) {
      toast('Admin always has full access — permissions cannot be changed.', { icon: '🛡️' });
      return;
    }
    if (!selectedRole) return;

    const permName = `${resource}:${action}`;
    const perm = permByName[permName];
    if (!perm) {
      toast.error(`Permission "${permName}" not found in database`);
      return;
    }

    const token = await getToken();
    if (!token) { toast.error('Not authenticated'); return; }

    const currentlyHas = assignmentSet.has(`${selectedRole.id}:${perm.id}`);
    setToggling(permName);

    try {
      if (currentlyHas) {
        const res = await fetch(
          `/api/admin/roles?role_id=${selectedRole.id}&permission_id=${perm.id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setAssignments((prev) =>
          prev.filter((a) => !(a.role_id === selectedRole.id && a.permission_id === perm.id))
        );
        toast.success(`Removed "${permName}" from ${selected}`);
      } else {
        const res = await fetch('/api/admin/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ role_id: selectedRole.id, permission_id: perm.id }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        setAssignments((prev) => [...prev, { role_id: selectedRole.id, permission_id: perm.id }]);
        toast.success(`Added "${permName}" to ${selected}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update permission');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click any permission to toggle it for the selected role. Changes save instantly to the database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role Selector */}
        <div className="space-y-2">
          {ROLE_ORDER.map((roleName) => (
            <button
              key={roleName}
              onClick={() => setSelected(roleName)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selected === roleName
                  ? roleColors[roleName] + ' font-semibold shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  <span>{roleName}</span>
                </div>
                <span className="text-xs font-normal opacity-70">{getPermCount(roleName)} perms</span>
              </div>
            </button>
          ))}

          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl border border-gray-200 transition-all mt-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Permissions Editor */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="card-content border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className={`badge border ${roleColors[selected]}`}>{selected}</span>
                <div>
                  <h2 className="font-semibold text-gray-900">{selected} Permissions</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{roleDescriptions[selected] ?? ''}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                  Admin has <strong className="mx-1">full access</strong> — all permissions are always granted and cannot be changed.
                </div>
              )}
            </div>

            <div className="card-content space-y-6">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton h-12 rounded-xl" />
                  ))}
                </div>
              ) : (
                ALL_PERMISSIONS.map(({ resource, label, actions }) => (
                  <div key={resource}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                      {label}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {actions.map(({ key, label: actionLabel }) => {
                        const granted = hasPermission(resource, key);
                        const permName = `${resource}:${key}`;
                        const isToggling = toggling === permName;
                        return (
                          <button
                            key={key}
                            onClick={() => togglePermission(resource, key)}
                            disabled={isAdmin || isToggling}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                              granted
                                ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                            } ${isAdmin ? 'cursor-default' : 'cursor-pointer'} ${isToggling ? 'opacity-60' : ''}`}
                          >
                            <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                              granted ? 'bg-green-500 text-white' : 'bg-gray-200'
                            }`}>
                              {granted && <Check className="w-2.5 h-2.5" />}
                            </span>
                            <span className="truncate">{actionLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="card mt-6">
            <div className="card-content border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Permissions Matrix</h3>
              <p className="text-xs text-gray-500 mt-0.5">Overview of all roles and permissions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide w-48">
                      Permission
                    </th>
                    {ROLE_ORDER.map((r) => (
                      <th key={r} className={`text-center px-3 py-3 font-semibold uppercase tracking-wide ${
                        selected === r ? 'text-gray-900 bg-gray-50' : 'text-gray-400'
                      }`}>
                        {r.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ALL_PERMISSIONS.flatMap(({ resource, actions }) =>
                    actions.map(({ key }) => {
                      const permName = `${resource}:${key}`;
                      return (
                        <tr key={permName} className="hover:bg-gray-50">
                          <td className="px-4 py-1.5 font-mono text-gray-600">{permName}</td>
                          {ROLE_ORDER.map((roleName) => {
                            const role = roleByName[roleName];
                            const perm = permByName[permName];
                            const has = roleName === 'ADMIN' ||
                              (role && perm && assignmentSet.has(`${role.id}:${perm.id}`));
                            return (
                              <td key={roleName} className={`px-3 py-1.5 text-center ${selected === roleName ? 'bg-gray-50' : ''}`}>
                                {has
                                  ? <span className="text-green-600 font-bold text-sm">✓</span>
                                  : <span className="text-gray-200 text-sm">–</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
