'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // used for auth session token only
import { ModifierGroup, Modifier } from '@/types';
import { formatCurrency } from '@/utils/helpers';
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupForm {
  name: string;
  is_required: boolean;
  min_selection: number;
  max_selection: string;
  display_order: number;
}

interface ModifierForm {
  name: string;
  price_adjustment: string;
  display_order: number;
}

const EMPTY_GROUP: GroupForm = { name: '', is_required: false, min_selection: 0, max_selection: '', display_order: 0 };
const EMPTY_MOD: ModifierForm = { name: '', price_adjustment: '0', display_order: 0 };

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

async function apiCall(method: string, body: object) {
  const token = await getToken();
  const res = await fetch('/api/admin/modifiers', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiDelete(id: number, entity: 'group' | 'modifier') {
  const token = await getToken();
  const res = await fetch(`/api/admin/modifiers?id=${id}&entity=${entity}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Delete failed');
  return data;
}

export default function ManagerModifiersPage() {
  const [groups, setGroups] = useState<(ModifierGroup & { modifiers: Modifier[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(EMPTY_GROUP);
  const [savingGroup, setSavingGroup] = useState(false);

  const [showModModal, setShowModModal] = useState(false);
  const [editingMod, setEditingMod] = useState<Modifier | null>(null);
  const [modForm, setModForm] = useState<ModifierForm>(EMPTY_MOD);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [savingMod, setSavingMod] = useState(false);

  const fetchGroups = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/modifiers');
    const json = await res.json();
    if (!res.ok) toast.error('Failed to load modifier groups');
    setGroups(json.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({ ...EMPTY_GROUP, display_order: groups.length });
    setShowGroupModal(true);
  };

  const openEditGroup = (g: ModifierGroup) => {
    setEditingGroup(g);
    setGroupForm({
      name: g.name, is_required: g.is_required, min_selection: g.min_selection,
      max_selection: g.max_selection != null ? String(g.max_selection) : '',
      display_order: g.display_order,
    });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) { toast.error('Name is required'); return; }
    setSavingGroup(true);
    try {
      const payload = {
        entity: 'group',
        name: groupForm.name.trim(),
        is_required: groupForm.is_required,
        min_selection: groupForm.min_selection,
        max_selection: groupForm.max_selection ? parseInt(groupForm.max_selection) : null,
        display_order: groupForm.display_order,
      };
      if (editingGroup) {
        await apiCall('PATCH', { id: editingGroup.id, ...payload });
        toast.success('Group updated');
      } else {
        await apiCall('POST', payload);
        toast.success('Group created');
      }
      setShowGroupModal(false);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save group');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: ModifierGroup) => {
    if (!confirm(`Delete "${g.name}"? All modifiers in this group will also be deleted.`)) return;
    try {
      await apiDelete(g.id, 'group');
      toast.success('Group deleted');
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group');
    }
  };

  const openCreateMod = (groupId: number, groupModCount: number) => {
    setEditingMod(null);
    setActiveGroupId(groupId);
    setModForm({ ...EMPTY_MOD, display_order: groupModCount });
    setShowModModal(true);
  };

  const openEditMod = (mod: Modifier) => {
    setEditingMod(mod);
    setActiveGroupId(mod.modifier_group_id);
    setModForm({ name: mod.name, price_adjustment: mod.price_adjustment.toString(), display_order: mod.display_order });
    setShowModModal(true);
  };

  const handleSaveMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modForm.name.trim()) { toast.error('Name is required'); return; }
    if (!activeGroupId) return;
    setSavingMod(true);
    try {
      const payload = {
        entity: 'modifier',
        name: modForm.name.trim(),
        price_adjustment: parseFloat(modForm.price_adjustment) || 0,
        display_order: modForm.display_order,
        modifier_group_id: activeGroupId,
      };
      if (editingMod) {
        await apiCall('PATCH', { id: editingMod.id, ...payload });
        toast.success('Modifier updated');
      } else {
        await apiCall('POST', payload);
        toast.success('Modifier added');
      }
      setShowModModal(false);
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save modifier');
    } finally {
      setSavingMod(false);
    }
  };

  const handleDeleteMod = async (mod: Modifier) => {
    if (!confirm(`Delete modifier "${mod.name}"?`)) return;
    try {
      await apiDelete(mod.id, 'modifier');
      toast.success('Modifier deleted');
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete modifier');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modifiers &amp; Add-Ons</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage modifier groups and their options with pricing</p>
        </div>
        <button onClick={openCreateGroup} className="btn btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No modifier groups yet</p>
          <p className="text-sm mt-1">Create a group like "Size" or "Milk Type" to get started</p>
          <button onClick={openCreateGroup} className="btn btn-primary mt-4 gap-2"><Plus className="w-4 h-4" /> Create First Group</button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isOpen = expanded.has(group.id);
            return (
              <div key={group.id} className="card">
                <div className="card-content flex items-center gap-3">
                  <button onClick={() => toggleExpand(group.id)} className="flex items-center gap-2 flex-1 text-left">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{group.name}</span>
                        {group.is_required && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">Required</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {group.modifiers.length} modifier{group.modifiers.length !== 1 ? 's' : ''}
                        {group.max_selection != null && ` · max ${group.max_selection}`}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { if (!isOpen) toggleExpand(group.id); setTimeout(() => openCreateMod(group.id, group.modifiers.length), 0); }}
                      className="btn btn-secondary btn-sm gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                    <button onClick={() => openEditGroup(group)} className="p-2 rounded-lg text-gray-400 hover:text-coffee-700 hover:bg-gray-100">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteGroup(group)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100">
                    {group.modifiers.length === 0 ? (
                      <div className="px-5 py-4 text-center text-gray-400 text-sm">
                        No modifiers yet.{' '}
                        <button onClick={() => openCreateMod(group.id, 0)} className="text-coffee-700 hover:underline">Add one</button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {group.modifiers.map((mod) => (
                          <div key={mod.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                            <span className="flex-1 text-sm font-medium text-gray-800">{mod.name}</span>
                            <span className={`text-sm font-semibold ${mod.price_adjustment > 0 ? 'text-green-600' : mod.price_adjustment < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                              {mod.price_adjustment > 0 ? '+' : ''}{formatCurrency(mod.price_adjustment)}
                            </span>
                            <button onClick={() => openEditMod(mod)} className="p-1.5 rounded-lg text-gray-400 hover:text-coffee-700 hover:bg-gray-100">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteMod(mod)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-5 py-3 border-t border-gray-50">
                      <button onClick={() => openCreateMod(group.id, group.modifiers.length)} className="text-sm text-coffee-700 hover:underline flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Add modifier
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowGroupModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">{editingGroup ? 'Edit Group' : 'New Modifier Group'}</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveGroup} className="p-6 space-y-4">
              <div>
                <label className="label">Group Name *</label>
                <input className="input" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="e.g. Size, Milk Type, Extras" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Min Selection</label>
                  <input className="input" type="number" min="0" value={groupForm.min_selection} onChange={(e) => setGroupForm({ ...groupForm, min_selection: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Max Selection</label>
                  <input className="input" type="number" min="1" value={groupForm.max_selection} onChange={(e) => setGroupForm({ ...groupForm, max_selection: e.target.value })} placeholder="Unlimited" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Display Order</label>
                  <input className="input" type="number" value={groupForm.display_order} onChange={(e) => setGroupForm({ ...groupForm, display_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="mgr_is_required" className="checkbox" checked={groupForm.is_required} onChange={(e) => setGroupForm({ ...groupForm, is_required: e.target.checked })} />
                  <label htmlFor="mgr_is_required" className="text-sm font-medium text-gray-700">Required</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowGroupModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={savingGroup} className="btn btn-primary flex-1 justify-center">
                  {savingGroup ? 'Saving…' : editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modifier Modal */}
      {showModModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">{editingMod ? 'Edit Modifier' : 'New Modifier'}</h2>
              <button onClick={() => setShowModModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveMod} className="p-6 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={modForm.name} onChange={(e) => setModForm({ ...modForm, name: e.target.value })} placeholder="e.g. Oat Milk, Extra Shot" required />
              </div>
              <div>
                <label className="label">Price Adjustment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input className="input pl-7" type="number" step="0.01" value={modForm.price_adjustment} onChange={(e) => setModForm({ ...modForm, price_adjustment: e.target.value })} placeholder="0.00" />
                </div>
                <p className="text-xs text-gray-400 mt-1">Positive for surcharge, negative for discount, 0 for free</p>
              </div>
              <div>
                <label className="label">Display Order</label>
                <input className="input" type="number" value={modForm.display_order} onChange={(e) => setModForm({ ...modForm, display_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={savingMod} className="btn btn-primary flex-1 justify-center">
                  {savingMod ? 'Saving…' : editingMod ? 'Save Changes' : 'Add Modifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
