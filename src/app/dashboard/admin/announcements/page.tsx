'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, X, Info, AlertTriangle, Tag, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // used for auth session token only
import { Announcement } from '@/types';
import toast from 'react-hot-toast';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableHeader } from '@/components/SortableHeader';

const TYPE_OPTIONS = [
  { value: 'info',      label: 'Info',      icon: Info,          color: 'bg-blue-100 text-blue-700' },
  { value: 'warning',   label: 'Warning',   icon: AlertTriangle, color: 'bg-amber-100 text-amber-700' },
  { value: 'promotion', label: 'Promotion', icon: Tag,           color: 'bg-green-100 text-green-700' },
  { value: 'event',     label: 'Event',     icon: Calendar,      color: 'bg-purple-100 text-purple-700' },
];

const typeBadge = (type: string) => {
  const t = TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{type}</span>;
};

const emptyForm = { title: '', body: '', type: 'info' as Announcement['type'], is_active: true, display_order: 0, expires_at: '' };

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { sorted, sortKey, sortDir, requestSort } = useTableSort(items, {
    title:    (a) => a.title,
    type:     (a) => a.type,
    status:   (a) => (a.is_active ? 1 : 0),
    order:    (a) => a.display_order,
    expires:  (a) => a.expires_at ?? '',
  });

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/announcements?all=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast.error('Failed to load announcements');
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal('create');
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      body: a.body ?? '',
      type: a.type,
      is_active: a.is_active,
      display_order: a.display_order,
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
    });
    setEditId(a.id);
    setModal('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      const payload = {
        ...form,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      if (modal === 'create') {
        const res = await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        toast.success('Announcement created');
      } else {
        const res = await fetch('/api/announcements', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editId, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        toast.success('Announcement updated');
      }

      setModal(null);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Announcement deleted');
      setDeleteId(null);
      fetchItems();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-coffee-700" />
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        </div>
        <button onClick={openCreate} className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <SortableHeader label="Title"   sortKey="title"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Type"    sortKey="type"    currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Status"  sortKey="status"  currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Order"   sortKey="order"   currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <SortableHeader label="Expires" sortKey="expires" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td></tr>
                  ))
                : sorted.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{a.title}</p>
                        {a.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.body}</p>}
                      </td>
                      <td className="px-5 py-3">{typeBadge(a.type)}</td>
                      <td className="px-5 py-3">
                        {a.is_active
                          ? <span className="badge badge-success">Active</span>
                          : <span className="badge badge-danger">Inactive</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{a.display_order}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {a.expires_at ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(a.expires_at)) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(a)} className="btn btn-secondary btn-sm">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {deleteId === a.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(a.id)} className="btn btn-danger btn-sm text-xs">Confirm</button>
                              <button onClick={() => setDeleteId(null)} className="btn btn-secondary btn-sm text-xs">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteId(a.id)} className="btn btn-secondary btn-sm text-red-500 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!loading && sorted.length === 0 && (
            <div className="text-center py-12">
              <Megaphone className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-400 text-sm">No announcements yet. Create one to display it on the homepage.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{modal === 'create' ? 'New Announcement' : 'Edit Announcement'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Holiday Hours"
                  required
                />
              </div>

              <div>
                <label className="label">Body (optional)</label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Type</label>
                  <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Announcement['type'] })}>
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Display Order</label>
                  <input
                    type="number"
                    className="input"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Expires At (optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to show indefinitely.</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  className="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer">Active (visible on homepage)</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1 justify-center">
                  {saving ? 'Saving…' : modal === 'create' ? 'Create' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
