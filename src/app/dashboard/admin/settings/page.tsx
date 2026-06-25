'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { HeroSlide } from '@/types';
import {
  Store, Clock, DollarSign, Power, PauseCircle, PlayCircle,
  Image as ImageIcon, Plus, Trash2, X, GripVertical, Upload, Eye, EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface StoreSettings {
  id: number;
  name: string;
  address: string;
  phone: string;
  store_status: 'open' | 'closed';
  ordering_status: boolean;
  tax_rate: number;
  estimated_wait_time: number;
}

interface SlideForm {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_href: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

const EMPTY_SLIDE: SlideForm = {
  title: '',
  subtitle: '',
  cta_text: 'Order Now',
  cta_href: '/#menu',
  image_url: '',
  display_order: 0,
  is_active: true,
};

async function uploadHeroImage(file: File, token: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bucket', 'hero-images');
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

export default function AdminSettingsPage() {
  const [location, setLocation] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    tax_rate: '',
    estimated_wait_time: '',
  });

  // Hero slides state
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [slideForm, setSlideForm] = useState<SlideForm>(EMPTY_SLIDE);
  const [savingSlide, setSavingSlide] = useState(false);
  const [slideImageFile, setSlideImageFile] = useState<File | null>(null);
  const [slideImagePreview, setSlideImagePreview] = useState('');
  const slideFileRef = useRef<HTMLInputElement>(null);

  const fetchLocation = async () => {
    setLoading(true);
    const { data } = await supabase.from('locations').select('*').eq('is_active', true).limit(1).single();
    if (data) {
      setLocation(data);
      setForm({
        name: data.name,
        address: data.address || '',
        phone: data.phone || '',
        tax_rate: (data.tax_rate * 100).toFixed(2),
        estimated_wait_time: String(data.estimated_wait_time),
      });
    }
    setLoading(false);
  };

  const fetchSlides = async () => {
    setSlidesLoading(true);
    const res = await fetch('/api/hero-slides');
    const data = await res.json();
    setSlides(data.slides || []);
    setSlidesLoading(false);
  };

  useEffect(() => {
    fetchLocation();
    fetchSlides();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('locations').update({
        name: form.name,
        address: form.address,
        phone: form.phone,
        tax_rate: parseFloat(form.tax_rate) / 100,
        estimated_wait_time: parseInt(form.estimated_wait_time),
      }).eq('id', location.id);
      if (error) throw error;
      toast.success('Settings saved');
      fetchLocation();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleStoreStatus = async () => {
    if (!location) return;
    const newStatus = location.store_status === 'open' ? 'closed' : 'open';
    try {
      const { error } = await supabase.from('locations').update({ store_status: newStatus }).eq('id', location.id);
      if (error) throw error;
      toast.success(`Store is now ${newStatus}`);
      fetchLocation();
    } catch {
      toast.error('Failed to update store status');
    }
  };

  const toggleOrdering = async () => {
    if (!location) return;
    try {
      const { error } = await supabase.from('locations').update({ ordering_status: !location.ordering_status }).eq('id', location.id);
      if (error) throw error;
      toast.success(`Ordering ${!location.ordering_status ? 'enabled' : 'paused'}`);
      fetchLocation();
    } catch {
      toast.error('Failed to update ordering status');
    }
  };

  const openSlideCreate = () => {
    setEditingSlide(null);
    setSlideForm({ ...EMPTY_SLIDE, display_order: slides.length });
    setSlideImageFile(null);
    setSlideImagePreview('');
    setShowSlideModal(true);
  };

  const openSlideEdit = (s: HeroSlide) => {
    setEditingSlide(s);
    setSlideForm({
      title: s.title || '',
      subtitle: s.subtitle || '',
      cta_text: s.cta_text,
      cta_href: s.cta_href,
      image_url: s.image_url,
      display_order: s.display_order,
      is_active: s.is_active,
    });
    setSlideImageFile(null);
    setSlideImagePreview(s.image_url);
    setShowSlideModal(true);
  };

  const handleSlideImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlideImageFile(file);
    setSlideImagePreview(URL.createObjectURL(file));
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideForm.image_url && !slideImageFile) {
      toast.error('Please provide an image');
      return;
    }
    setSavingSlide(true);
    try {
      let imageUrl = slideForm.image_url;
      if (slideImageFile) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');
        imageUrl = await uploadHeroImage(slideImageFile, session.access_token);
      }

      const payload = { ...slideForm, image_url: imageUrl };

      if (editingSlide) {
        await fetch('/api/hero-slides', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingSlide.id, ...payload }),
        });
        toast.success('Slide updated');
      } else {
        await fetch('/api/hero-slides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.success('Slide created');
      }

      setShowSlideModal(false);
      fetchSlides();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save slide');
    } finally {
      setSavingSlide(false);
    }
  };

  const deleteSlide = async (id: number) => {
    if (!confirm('Delete this hero slide?')) return;
    await fetch(`/api/hero-slides?id=${id}`, { method: 'DELETE' });
    toast.success('Slide deleted');
    fetchSlides();
  };

  const toggleSlideActive = async (slide: HeroSlide) => {
    await fetch('/api/hero-slides', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slide.id, is_active: !slide.is_active }),
    });
    fetchSlides();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Store Controls */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={toggleStoreStatus}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-semibold transition-all ${
            location?.store_status === 'open'
              ? 'border-green-400 bg-green-50 text-green-700'
              : 'border-red-300 bg-red-50 text-red-700'
          }`}
        >
          <Power className="w-6 h-6" />
          <span className="text-sm">Store: {location?.store_status === 'open' ? 'OPEN' : 'CLOSED'}</span>
          <span className="text-xs font-normal opacity-70">Click to toggle</span>
        </button>

        <button
          onClick={toggleOrdering}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-semibold transition-all ${
            location?.ordering_status
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-amber-300 bg-amber-50 text-amber-700'
          }`}
        >
          {location?.ordering_status ? <PauseCircle className="w-6 h-6" /> : <PlayCircle className="w-6 h-6" />}
          <span className="text-sm">Ordering: {location?.ordering_status ? 'ACTIVE' : 'PAUSED'}</span>
          <span className="text-xs font-normal opacity-70">Click to toggle</span>
        </button>
      </div>

      {/* Store Information Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="card">
          <div className="card-content border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-coffee-700" />
              <h2 className="font-semibold text-gray-900">Store Information</h2>
            </div>
          </div>
          <div className="card-content space-y-4">
            <div>
              <label className="label">Store Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Coffee St, New York, NY" />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(212) 555-1234" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content border-b border-gray-100">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-coffee-700" />
              <h2 className="font-semibold text-gray-900">Business Settings</h2>
            </div>
          </div>
          <div className="card-content grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tax Rate (%)</label>
              <input className="input" type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">e.g., 8.75 for 8.75%</p>
            </div>
            <div>
              <label className="label">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Estimated Wait (min)
              </label>
              <input className="input" type="number" min="1" max="120" value={form.estimated_wait_time} onChange={(e) => setForm({ ...form, estimated_wait_time: e.target.value })} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary w-full justify-center">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>

      {/* Hero Slider Section */}
      <div className="card">
        <div className="card-content border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-coffee-700" />
            <h2 className="font-semibold text-gray-900">Homepage Hero Slider</h2>
          </div>
          <button onClick={openSlideCreate} className="btn btn-primary btn-sm gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add Slide
          </button>
        </div>

        <div className="card-content">
          {slidesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
            </div>
          ) : slides.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No slides yet. Add your first hero slide.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {slides.map((slide) => (
                <div key={slide.id} className={`flex items-center gap-3 p-3 rounded-xl border ${slide.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <div className="w-16 h-10 rounded-lg overflow-hidden bg-coffee-100 flex-shrink-0">
                    <img src={slide.image_url} alt={slide.title || ''} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{slide.title || 'Untitled Slide'}</p>
                    <p className="text-xs text-gray-400 truncate">{slide.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleSlideActive(slide)}
                      title={slide.is_active ? 'Hide slide' : 'Show slide'}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    >
                      {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openSlideEdit(slide)} className="p-1.5 rounded-lg text-gray-400 hover:text-coffee-700 hover:bg-gray-100">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSlide(slide.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide Modal */}
      {showSlideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSlideModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">{editingSlide ? 'Edit Slide' : 'New Hero Slide'}</h2>
              <button onClick={() => setShowSlideModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSlide} className="p-6 space-y-4">
              {/* Image */}
              <div>
                <label className="label">Slide Image *</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-coffee-400 transition-colors"
                  onClick={() => slideFileRef.current?.click()}
                >
                  {slideImagePreview ? (
                    <img src={slideImagePreview} alt="Preview" className="h-36 w-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-300" />
                      <p className="text-sm text-gray-400">Click to upload image</p>
                      <p className="text-xs text-gray-300">Recommended: 1920×600px</p>
                    </>
                  )}
                </div>
                <input ref={slideFileRef} type="file" accept="image/*" className="hidden" onChange={handleSlideImageChange} />
                {!slideImageFile && (
                  <input
                    className="input mt-2"
                    value={slideForm.image_url}
                    onChange={(e) => { setSlideForm({ ...slideForm, image_url: e.target.value }); setSlideImagePreview(e.target.value); }}
                    placeholder="Or paste image URL…"
                  />
                )}
              </div>

              <div>
                <label className="label">Title</label>
                <input className="input" value={slideForm.title} onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })} placeholder="Fresh Brews, Every Morning" />
              </div>
              <div>
                <label className="label">Subtitle</label>
                <input className="input" value={slideForm.subtitle} onChange={(e) => setSlideForm({ ...slideForm, subtitle: e.target.value })} placeholder="Crafted with care, served with love" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">CTA Button Text</label>
                  <input className="input" value={slideForm.cta_text} onChange={(e) => setSlideForm({ ...slideForm, cta_text: e.target.value })} />
                </div>
                <div>
                  <label className="label">CTA Link</label>
                  <input className="input" value={slideForm.cta_href} onChange={(e) => setSlideForm({ ...slideForm, cta_href: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Display Order</label>
                  <input className="input" type="number" value={slideForm.display_order} onChange={(e) => setSlideForm({ ...slideForm, display_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="slide_active" className="checkbox" checked={slideForm.is_active} onChange={(e) => setSlideForm({ ...slideForm, is_active: e.target.checked })} />
                  <label htmlFor="slide_active" className="text-sm font-medium text-gray-700">Active (visible)</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSlideModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={savingSlide} className="btn btn-primary flex-1 justify-center">
                  {savingSlide ? 'Saving…' : editingSlide ? 'Save Changes' : 'Add Slide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
