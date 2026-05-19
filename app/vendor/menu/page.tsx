'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Camera } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { MenuItem, Category } from '@/types';
import { PLATFORM } from '@/constants/config';
import { pickAndUploadImage, pickAndUploadSinglePhoto } from '@/utils/imageUpload';
import styles from './menu.module.css';

export default function VendorMenuPage() {
  const { restaurant } = useAuthStore();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const [name, setName] = useState('');
  const [description, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCatId] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [uploadingSlot, setUpSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase.from('menu_items').select('*, category:categories(name,icon)').eq('restaurant_id', restaurant.id).order('sort_order');
    if (data) setItems(data as MenuItem[]);
    setLoading(false);
  }, [restaurant]);

  useEffect(() => {
    fetchItems();
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => { if (data) setCategories(data as Category[]); });
  }, [fetchItems]);

  const openAdd = () => { setEditing(null); setName(''); setDesc(''); setPrice(''); setCatId(null); setAvailable(true); setPhotos([null, null, null, null]); setModal(true); };
  const openEdit = (item: MenuItem) => {
    setEditing(item); setName(item.name); setDesc(item.description ?? ''); setPrice(String(item.price)); setCatId(item.category_id); setAvailable(item.is_available);
    const extras = item.image_urls ?? [];
    setPhotos([item.image_url ?? null, extras[0] ?? null, extras[1] ?? null, extras[2] ?? null]);
    setModal(true);
  };

  const handlePickSlot = async (slot: number) => {
    if (!restaurant) return;
    setUpSlot(slot);
    const url = slot === 0 ? await pickAndUploadImage('menu-images', restaurant.id) : await pickAndUploadSinglePhoto('menu-images', restaurant.id);
    if (url) setPhotos(prev => { const next = [...prev]; next[slot] = url; return next; });
    setUpSlot(null);
  };

  const handleSave = async () => {
    if (!name.trim()) { alert('Item name is required.'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) { alert('Enter a valid price.'); return; }
    if (!restaurant) return;
    setSaving(true);
    const payload = { restaurant_id: restaurant.id, name: name.trim(), description: description.trim() || null, price: parsedPrice, category_id: categoryId, is_available: available, image_url: photos[0] ?? null, image_urls: photos.slice(1).filter(Boolean) as string[] };
    const { error } = editing ? await supabase.from('menu_items').update(payload).eq('id', editing.id) : await supabase.from('menu_items').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setModal(false); fetchItems();
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Remove "${item.name}" from your menu?`)) return;
    await supabase.from('menu_items').delete().eq('id', item.id); fetchItems();
  };

  const toggleAvailability = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id); fetchItems();
  };

  if (!restaurant) return <div className={styles.center}><p>No restaurant found.</p></div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><h1 className={styles.headerTitle}>Menu</h1><p className={styles.headerSub}>{items.length} item{items.length !== 1 ? 's' : ''}</p></div>
        <button className={styles.addBtn} onClick={openAdd} id="btn-add-item"><Plus size={22} /> Add Item</button>
      </div>

      {loading ? <div className="page-loader"><span className="spinner spinner--primary" /></div>
        : items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🍽️</span>
            <p className={styles.emptyTitle}>No menu items yet</p>
            <p className={styles.emptySub}>Add your first item to start attracting customers</p>
            <button className={styles.emptyBtn} onClick={openAdd}>Add First Item</button>
          </div>
        ) : (
          <div className={styles.list}>
            {items.map(item => (
              <div key={item.id} className={styles.itemCard}>
                {(item.image_url || (item.image_urls?.length ?? 0) > 0) && (
                  <div className={styles.itemImageStrip}>
                    {[item.image_url, ...(item.image_urls ?? [])].filter(Boolean).map((u, i) => (
                      <img key={i} src={u!} alt="" className={styles.itemThumb} />
                    ))}
                  </div>
                )}
                <div className={styles.itemInfo}>
                  <div className={styles.itemTop}>
                    <p className={styles.itemName}>{item.name}</p>
                    <p className={styles.itemPrice}>{PLATFORM.currencySymbol}{item.price.toFixed(2)}</p>
                  </div>
                  {item.description && <p className={styles.itemDesc}>{item.description}</p>}
                  {item.category && <p className={styles.itemCat}>{(item as any).category.icon} {(item as any).category.name}</p>}
                  <div className={styles.itemActions}>
                    <button className={`${styles.availBadge}${!item.is_available ? ` ${styles.availBadgeOff}` : ''}`} onClick={() => toggleAvailability(item)}>
                      <span className={`${styles.availText}${!item.is_available ? ` ${styles.availTextOff}` : ''}`}>{item.is_available ? '✓ Available' : '✗ Unavailable'}</span>
                    </button>
                    <button className={styles.iconBtn} onClick={() => openEdit(item)}><Pencil size={16} color="var(--color-primary)" /></button>
                    <button className={styles.iconBtn} onClick={() => handleDelete(item)}><Trash2 size={16} color="var(--color-error)" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <div className={styles.modalOverlay} onClick={() => setModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <p className={styles.modalTitle}>{editing ? 'Edit Item' : 'New Menu Item'}</p>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24 }}>✕</button>
            </div>
            <div className={styles.modalForm}>
              {/* Photo grid */}
              <div className={styles.formField}>
                <p className={styles.fieldLabel}>Photos (up to 4)</p>
                <p className={styles.fieldSub}>Slot 1 is the cover. Tap a slot to add or replace.</p>
                <div className={styles.photoGrid}>
                  {photos.map((url, slot) => (
                    <div key={slot} className={styles.photoSlotWrap}>
                      <button className={`${styles.photoSlot}${url ? ` ${styles.photoSlotFilled}` : ''}`} onClick={() => handlePickSlot(slot)} disabled={uploadingSlot !== null}>
                        {url ? <img src={url} alt="" className={styles.photoImg} /> : (
                          <div className={styles.photoSlotEmpty}><Camera size={26} color="var(--color-text-muted)" /><span className={styles.photoSlotLabel}>{slot === 0 ? 'Cover' : `Photo ${slot + 1}`}</span></div>
                        )}
                        {uploadingSlot === slot && <div className={styles.photoOverlay}><span className="spinner" /></div>}
                      </button>
                      {url && <button className={styles.photoRemove} onClick={() => setPhotos(p => { const n=[...p]; n[slot]=null; return n; })}><X size={14} /></button>}
                      {slot === 0 && url && <span className={styles.coverBadge}>Cover</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formField}><p className={styles.fieldLabel}>Item Name *</p><input className={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jollof Rice" /></div>
              <div className={styles.formField}><p className={styles.fieldLabel}>Description</p><textarea className={styles.input} value={description} onChange={e => setDesc(e.target.value)} placeholder="What's in it? What makes it special?" rows={3} /></div>
              <div className={styles.formField}><p className={styles.fieldLabel}>Price ({PLATFORM.currencySymbol}) *</p><input className={styles.input} type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>

              <div className={styles.formField}>
                <p className={styles.fieldLabel}>Category</p>
                <div className={styles.catRow}>
                  {categories.map(c => (
                    <button key={c.id} className={`${styles.catChip}${categoryId === c.id ? ` ${styles.catChipActive}` : ''}`} onClick={() => setCatId(c.id === categoryId ? null : c.id)}>
                      {(c as any).icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.switchRow}>
                <div><p className={styles.fieldLabel}>Available</p><p className={styles.fieldSub}>Toggle off if temporarily sold out</p></div>
                <label className={styles.toggle}><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} /><span className={styles.toggleSlider} /></label>
              </div>

              <button className={styles.saveBtn} onClick={handleSave} disabled={saving} id="btn-save-item">
                {saving ? <span className="spinner" /> : editing ? 'Save Changes' : 'Add to Menu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
