'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Category } from '@/types';
import { formatCurrency } from '@/utils/helpers';
import { Plus, Pencil, Trash2, Search, Coffee, X, Upload, Star, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductForm {
  name: string;
  description: string;
  category_id: number | '';
  base_price: string;
  is_available: boolean;
  is_featured: boolean;
  display_order: string;
  image_url: string;
  stock: string;
}

interface CategoryForm {
  name: string;
  description: string;
  display_order: string;
  is_active: boolean;
}

const EMPTY_PRODUCT: ProductForm = {
  name: '', description: '', category_id: '', base_price: '',
  is_available: true, is_featured: false, display_order: '0', image_url: '', stock: '',
};

const EMPTY_CATEGORY: CategoryForm = {
  name: '', description: '', display_order: '0', is_active: true,
};

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

async function uploadImage(file: File): Promise<string> {
  const token = await getToken();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('bucket', 'product-images');
  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

export default function ManagerProductsPage() {
  const [tab, setTab] = useState<'products' | 'categories'>('products');

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<number | 'ALL'>('ALL');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(EMPTY_PRODUCT);
  const [savingProduct, setSavingProduct] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Categories
  const [catLoading, setCatLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(EMPTY_CATEGORY);
  const [savingCat, setSavingCat] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [prodsRes, { data: cats }] = await Promise.all([
      fetch('/api/products?all=true').then((r) => r.json()),
      supabase.from('categories').select('*').order('display_order'),
    ]);
    setProducts(prodsRes.data || []);
    setCategories(cats || []);
    setLoading(false);
  };

  const fetchCategories = async () => {
    setCatLoading(true);
    const { data } = await supabase.from('categories').select('*').order('display_order');
    setCategories(data || []);
    setCatLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Product CRUD
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setImageFile(null);
    setImagePreview('');
    setShowProductModal(true);
  };

  const openEditProduct = async (p: Product) => {
    const invRes = await fetch(`/api/inventory?product_id=${p.id}&location_id=1`).then((r) => r.json());
    const stock = invRes.data?.[0]?.current_stock ?? '';
    setEditingProduct(p);
    setProductForm({
      name: p.name, description: p.description || '',
      category_id: p.category_id, base_price: p.base_price.toString(),
      is_available: p.is_available, is_featured: p.is_featured ?? false,
      display_order: p.display_order.toString(), image_url: p.image_url || '',
      stock: stock === '' ? '' : String(stock),
    });
    setImageFile(null);
    setImagePreview(p.image_url || '');
    setShowProductModal(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.base_price || productForm.category_id === '') {
      toast.error('Please fill all required fields');
      return;
    }
    setSavingProduct(true);
    try {
      let imageUrl = productForm.image_url;
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile);
        setUploading(false);
      }
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        category_id: Number(productForm.category_id),
        base_price: parseFloat(productForm.base_price),
        is_available: productForm.is_available,
        is_featured: productForm.is_featured,
        display_order: parseInt(productForm.display_order) || 0,
        image_url: imageUrl || null,
        modifier_group_ids: [],
        stock: productForm.stock,
      };
      if (editingProduct) {
        await apiCall('/api/admin/products', 'PATCH', { id: editingProduct.id, ...payload });
        toast.success('Product updated');
      } else {
        await apiCall('/api/admin/products', 'POST', payload);
        toast.success('Product created');
      }
      setShowProductModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/products?id=${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.softDeleted) {
        toast.success(`"${p.name}" has order history — marked as unavailable instead of deleted`);
      } else {
        toast.success('Product deleted');
      }
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    }
  };

  // Category CRUD
  const openCreateCat = () => {
    setEditingCat(null);
    setCatForm({ ...EMPTY_CATEGORY, display_order: String(categories.length) });
    setShowCatModal(true);
  };

  const openEditCat = (c: Category) => {
    setEditingCat(c);
    setCatForm({
      name: c.name, description: c.description || '',
      display_order: String(c.display_order), is_active: c.is_active,
    });
    setShowCatModal(true);
  };

  const handleSaveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.error('Name is required'); return; }
    setSavingCat(true);
    try {
      const payload = {
        name: catForm.name.trim(),
        description: catForm.description.trim() || null,
        display_order: parseInt(catForm.display_order) || 0,
        is_active: catForm.is_active,
      };
      if (editingCat) {
        await apiCall('/api/admin/categories', 'PATCH', { id: editingCat.id, ...payload });
        toast.success('Category updated');
      } else {
        await apiCall('/api/admin/categories', 'POST', payload);
        toast.success('Category created');
      }
      setShowCatModal(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/categories?id=${c.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === 'ALL' || p.category_id === catFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        {tab === 'products' ? (
          <button onClick={openCreateProduct} className="btn btn-primary gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        ) : (
          <button onClick={openCreateCat} className="btn btn-primary gap-2">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'products', label: 'Products', icon: Coffee },
          { key: 'categories', label: 'Categories', icon: Tag },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all ${
              tab === key
                ? 'border-coffee-700 text-coffee-800'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-normal">
              {key === 'products' ? products.length : categories.length}
            </span>
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === 'products' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="input pl-9" />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))} className="select">
              <option value="ALL">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Product', 'Category', 'Price', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map((p) => {
                      const cat = categories.find((c) => c.id === p.category_id);
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-coffee-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Coffee className="w-4 h-4 text-coffee-500" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-medium text-gray-900">{p.name}</p>
                                  {p.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-400" />}
                                </div>
                                {p.description && <p className="text-xs text-gray-500 truncate max-w-48">{p.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{cat?.name || '—'}</td>
                          <td className="px-5 py-3 font-semibold text-coffee-700">{formatCurrency(p.base_price)}</td>
                          <td className="px-5 py-3">
                            <span className={`badge ${p.is_available ? 'badge-success' : 'badge-danger'}`}>{p.is_available ? 'Available' : 'Unavailable'}</span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => openEditProduct(p)} className="btn btn-secondary btn-sm gap-1">
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button onClick={() => handleDeleteProduct(p)} className="btn btn-sm px-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!loading && filteredProducts.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Coffee className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No products found.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Category', 'Description', 'Order', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {catLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="skeleton h-4 rounded" /></td></tr>
                  ))
                ) : categories.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-coffee-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Tag className="w-3.5 h-3.5 text-coffee-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{c.description || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{c.display_order}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>{c.is_active ? 'Active' : 'Hidden'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditCat(c)} className="btn btn-secondary btn-sm gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDeleteCat(c)} className="btn btn-sm px-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!catLoading && categories.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No categories yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowProductModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
              <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div>
                <label className="label">Product Image</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-coffee-400 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-28 w-full object-cover rounded-lg" />
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-gray-300" />
                      <p className="text-sm text-gray-400">Click to upload image</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                {imagePreview && (
                  <button type="button" onClick={() => { setImagePreview(''); setImageFile(null); setProductForm((f) => ({ ...f, image_url: '' })); }} className="text-xs text-red-500 hover:underline mt-1">Remove</button>
                )}
                {!imageFile && (
                  <input className="input mt-2" value={productForm.image_url} onChange={(e) => { setProductForm({ ...productForm, image_url: e.target.value }); setImagePreview(e.target.value); }} placeholder="Or paste image URL…" />
                )}
              </div>
              <div>
                <label className="label">Name *</label>
                <input className="input" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="textarea" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Category *</label>
                  <select className="select" value={productForm.category_id} onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value ? parseInt(e.target.value) : '' })} required>
                    <option value="">Select…</option>
                    {categories.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Base Price *</label>
                  <input className="input" type="number" min="0" step="0.01" value={productForm.base_price} onChange={(e) => setProductForm({ ...productForm, base_price: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Stock Quantity</label>
                  <input className="input" type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label className="label">Order</label>
                  <input className="input" type="number" value={productForm.display_order} onChange={(e) => setProductForm({ ...productForm, display_order: e.target.value })} />
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="m_available" className="checkbox" checked={productForm.is_available} onChange={(e) => setProductForm({ ...productForm, is_available: e.target.checked })} />
                  <label htmlFor="m_available" className="text-sm font-medium text-gray-700">Available</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="m_featured" className="checkbox" checked={productForm.is_featured} onChange={(e) => setProductForm({ ...productForm, is_featured: e.target.checked })} />
                  <label htmlFor="m_featured" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" /> Featured
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowProductModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={savingProduct || uploading} className="btn btn-primary flex-1 justify-center">
                  {uploading ? 'Uploading…' : savingProduct ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCatModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">{editingCat ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowCatModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveCat} className="p-6 space-y-4">
              <div>
                <label className="label">Category Name *</label>
                <input className="input" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Hot Drinks, Pastries" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="textarea" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Display Order</label>
                  <input className="input" type="number" min="0" value={catForm.display_order} onChange={(e) => setCatForm({ ...catForm, display_order: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="mcat_active" className="checkbox" checked={catForm.is_active} onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })} />
                  <label htmlFor="mcat_active" className="text-sm font-medium text-gray-700">Active</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCatModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={savingCat} className="btn btn-primary flex-1 justify-center">
                  {savingCat ? 'Saving…' : editingCat ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
