'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // used for auth session token only
import { User } from '@/types';
import { getRoleLabel, formatDateTime } from '@/utils/helpers';
import { Plus, Search, Pencil, UserX, UserCheck, X, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';
import toast from 'react-hot-toast';

interface UserRow extends User {
  role: { name: string };
  location?: { name: string };
  group_number?: number;
}

interface Role {
  id: number;
  name: string;
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

async function apiCall(url: string, method: string, body?: object) {
  const token = await getToken();
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', role_id: '', password: '', phone: '', group_number: '' });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pwModal, setPwModal] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [usersJson, rolesJson] = await Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/roles').then((r) => r.json()),
    ]);
    setUsers(usersJson.data || []);
    setRoles(rolesJson.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setCurrentUserId(session.user.id);
    });
  }, []);

  const openEdit = (u: UserRow) => {
    setEditing(u);
    setForm({ full_name: u.full_name, email: u.email, role_id: String(u.role_id), password: '', phone: u.phone || '', group_number: u.group_number != null ? String(u.group_number) : '' });
    setShowPassword(false);
    setShowModal(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', role_id: '', password: '', phone: '', group_number: '' });
    setShowPassword(false);
    setShowModal(true);
  };

  const selectedRoleName = roles.find((r) => String(r.id) === form.role_id)?.name;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const groupNum = selectedRoleName === 'GROUP_LEADER' && form.group_number ? Number(form.group_number) : null;
      if (editing) {
        await apiCall('/api/admin/users', 'PATCH', {
          id: editing.id,
          full_name: form.full_name.trim(),
          role_id: Number(form.role_id),
          phone: form.phone.trim() || null,
          group_number: groupNum,
        });
        toast.success('User updated');
      } else {
        if (!form.password || form.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setSaving(false);
          return;
        }
        await apiCall('/api/admin/users', 'POST', {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          role_id: Number(form.role_id),
          phone: form.phone.trim() || null,
          group_number: groupNum,
        });
        toast.success('User created — they can now log in with their email and password');
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      await apiCall('/api/admin/users', 'PATCH', { id: u.id, is_active: !u.is_active });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      fetchData();
    } catch {
      toast.error('Failed to update user');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwModal) return;
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingPw(true);
    try {
      await apiCall('/api/admin/users', 'PATCH', { id: pwModal.id, password: newPassword });
      toast.success(`Password updated for ${pwModal.full_name}`);
      setPwModal(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteUser = async (u: UserRow) => {
    if (!window.confirm(`Permanently delete ${u.full_name}? This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users?id=${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success(`${u.full_name} has been deleted`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const preFiltered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted: filtered, sortKey, sortDir, requestSort } = useTableSort(preFiltered, {
    name:    (u) => u.full_name,
    email:   (u) => u.email,
    role:    (u) => u.role?.name,
    phone:   (u) => u.phone,
    joined:  (u) => u.created_at,
    status:  (u) => u.is_active ? 1 : 0,
  });

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-100 text-red-800',
    MANAGER: 'bg-purple-100 text-purple-800',
    BARISTA: 'bg-blue-100 text-blue-800',
    CASHIER: 'bg-green-100 text-green-800',
    CUSTOMER: 'bg-gray-100 text-gray-800',
    GROUP_LEADER: 'bg-amber-100 text-amber-800',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={openCreate} className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input pl-9"
        />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <SortableHeader label="Name"    sortKey="name"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Email"   sortKey="email"  currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Role"    sortKey="role"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Phone"   sortKey="phone"  currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Joined"  sortKey="joined" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Status"  sortKey="status" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td>
                    </tr>
                  ))
                : filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{user.full_name}</td>
                      <td className="px-5 py-3 text-gray-600">{user.email}</td>
                      <td className="px-5 py-3">
                        <span className={`badge ${roleColors[user.role?.name] || 'bg-gray-100 text-gray-700'}`}>
                          {user.role?.name}
                        </span>
                        {user.role?.name === 'GROUP_LEADER' && user.group_number != null && (
                          <p className="text-xs text-gray-400 mt-0.5">Group {user.group_number}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{user.phone || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDateTime(user.created_at)}</td>
                      <td className="px-5 py-3">
                        {user.is_active
                          ? <span className="badge badge-success">Active</span>
                          : <span className="badge badge-danger">Inactive</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(user)} className="btn btn-secondary btn-sm px-2" title="Edit user">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setPwModal(user); setNewPassword(''); setShowNewPw(false); }}
                            className="btn btn-sm px-2 text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg"
                            title="Change password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleActive(user)}
                            className={`btn btn-sm px-2 ${
                              user.is_active
                                ? 'text-red-600 hover:bg-red-50 border border-red-200 rounded-lg'
                                : 'text-green-600 hover:bg-green-50 border border-green-200 rounded-lg'
                            }`}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                          {user.id !== currentUserId && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={deletingId === user.id}
                              className="btn btn-sm px-2 text-red-700 hover:bg-red-50 border border-red-300 rounded-lg disabled:opacity-50"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400">No users found.</div>
          )}
        </div>
      </div>

      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPwModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg">Change Password</h2>
                <p className="text-sm text-gray-500 mt-0.5">{pwModal.full_name}</p>
              </div>
              <button onClick={() => setPwModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="label">New Password *</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    className="input pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    minLength={6}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setPwModal(null)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={savingPw} className="btn btn-primary flex-1 justify-center">
                  {savingPw ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editing ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
              </div>

              {!editing && (
                <>
                  <div>
                    <label className="label">Email *</label>
                    <input
                      type="email"
                      className="input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="john@nylocale.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input pr-10"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Min. 6 characters"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">The user will log in with this password.</p>
                  </div>
                </>
              )}

              <div>
                <label className="label">Role *</label>
                <select
                  className="select"
                  value={form.role_id}
                  onChange={(e) => setForm({ ...form, role_id: e.target.value, group_number: '' })}
                  required
                >
                  <option value="">Select role…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {selectedRoleName === 'GROUP_LEADER' && (
                <div>
                  <label className="label">Group Number *</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={form.group_number}
                    onChange={(e) => setForm({ ...form, group_number: e.target.value })}
                    placeholder="e.g., 5"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">This user will only see reports for this group.</p>
                </div>
              )}

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1 justify-center">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
