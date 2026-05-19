'use client';

import React, { useState } from 'react';
import { Save, Camera, Image as ImageIcon, Info } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { FOOD_CATEGORIES } from '@/constants/config';
import { pickAndUploadImage } from '@/utils/imageUpload';
import styles from './restaurant.module.css';

function parseTimePart(str: string) {
  const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return { hr: 8, min: '00', ampm: 'AM' as 'AM'|'PM' };
  return { hr: parseInt(m[1]), min: m[2], ampm: m[3].toUpperCase() as 'AM'|'PM' };
}
function splitHours(h: string) {
  const parts = h.split(/\s*[–—-]\s*/);
  return { open: parseTimePart(parts[0] ?? '8:00 AM'), close: parseTimePart(parts[1] ?? '9:00 PM') };
}

function TimeSlot({ label, hr, min, ampm, onHr, onMin, onAmPm }: { label: string; hr: number; min: string; ampm: 'AM'|'PM'; onHr:(v:number)=>void; onMin:(v:string)=>void; onAmPm:(v:'AM'|'PM')=>void; }) {
  return (
    <div className={styles.timeSlot}>
      <p className={styles.timeSlotLabel}>{label}</p>
      <div className={styles.timeSlotRow}>
        <div className={styles.spinner}>
          <button type="button" className={styles.spinArrow} onClick={() => onHr(hr === 12 ? 1 : hr + 1)}>▲</button>
          <span className={styles.spinValue}>{String(hr).padStart(2,'0')}</span>
          <button type="button" className={styles.spinArrow} onClick={() => onHr(hr === 1 ? 12 : hr - 1)}>▼</button>
        </div>
        <span className={styles.timeSep}>:</span>
        <div className={styles.chipGroup}>
          {['00','30'].map(m => <button key={m} type="button" className={`${styles.chip}${min===m?` ${styles.chipActive}`:''}`} onClick={()=>onMin(m)}>{m}</button>)}
        </div>
        <div className={styles.chipGroup}>
          {(['AM','PM'] as const).map(p => <button key={p} type="button" className={`${styles.chip}${ampm===p?` ${styles.chipActive}`:''}`} onClick={()=>onAmPm(p)}>{p}</button>)}
        </div>
      </div>
    </div>
  );
}

export default function VendorRestaurantPage() {
  const { restaurant, user, fetchVendorRestaurant } = useAuthStore();
  const [name, setName] = useState(restaurant?.name ?? '');
  const [description, setDesc] = useState(restaurant?.description ?? '');
  const [phone, setPhone] = useState(restaurant?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(restaurant?.whatsapp ?? '');
  const [address, setAddress] = useState(restaurant?.address ?? '');
  const [city, setCity] = useState(restaurant?.city ?? '');
  const [category, setCategory] = useState(restaurant?.food_category ?? 'Local');
  const init = splitHours(restaurant?.opening_hours ?? '8:00 AM – 9:00 PM');
  const [openHr, setOpenHr] = useState(init.open.hr);
  const [openMin, setOpenMin] = useState(init.open.min);
  const [openAmPm, setOpenAmPm] = useState<'AM'|'PM'>(init.open.ampm);
  const [closeHr, setCloseHr] = useState(init.close.hr);
  const [closeMin, setCloseMin] = useState(init.close.min);
  const [closeAmPm, setCloseAmPm] = useState<'AM'|'PM'>(init.close.ampm);
  const [latStr, setLatStr] = useState(restaurant?.latitude ? String(restaurant.latitude) : '');
  const [lngStr, setLngStr] = useState(restaurant?.longitude ? String(restaurant.longitude) : '');
  const [logoUrl, setLogoUrl] = useState<string|null>(restaurant?.logo_url ?? null);
  const [coverUrl, setCoverUrl] = useState<string|null>(restaurant?.cover_url ?? null);
  const [uploadingLogo, setUpLogo] = useState(false);
  const [uploadingCover, setUpCover] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickLogo = async () => { if (!restaurant) return; setUpLogo(true); const url = await pickAndUploadImage('restaurant-images', `${restaurant.id}/logo`); if (url) setLogoUrl(url); setUpLogo(false); };
  const handlePickCover = async () => { if (!restaurant) return; setUpCover(true); const url = await pickAndUploadImage('restaurant-images', `${restaurant.id}/cover`); if (url) setCoverUrl(url); setUpCover(false); };

  const handleSave = async () => {
    if (!name.trim()) { alert('Restaurant name is required.'); return; }
    if (!phone.trim()) { alert('Phone number is required so customers can call.'); return; }
    if (!restaurant) return;
    let latitude: number|null = null, longitude: number|null = null;
    if (latStr || lngStr) {
      if (!latStr || !lngStr) { alert('Enter both latitude and longitude, or leave both empty.'); return; }
      const lat = parseFloat(latStr), lng = parseFloat(lngStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { alert('Latitude and longitude must be valid numbers.'); return; }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { alert('Latitude must be −90…90 and longitude −180…180.'); return; }
      latitude = lat; longitude = lng;
    }
    setSaving(true);
    const { error } = await supabase.from('restaurants').update({
      name: name.trim(), description: description.trim() || null, phone: phone.trim(),
      whatsapp: whatsapp.trim() || null, address: address.trim() || null, city: city.trim() || null,
      food_category: category, opening_hours: `${openHr}:${openMin} ${openAmPm} – ${closeHr}:${closeMin} ${closeAmPm}`,
      logo_url: logoUrl, cover_url: coverUrl, latitude, longitude, updated_at: new Date().toISOString(),
    }).eq('id', restaurant.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    if (user) await fetchVendorRestaurant(user.id);
    alert('Restaurant profile updated successfully ✓');
  };

  if (!restaurant) return <div className={styles.center}><p>No restaurant found.</p></div>;

  const subActive = restaurant.subscription_expires_at && new Date(restaurant.subscription_expires_at) >= new Date();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>Restaurant Profile</h1>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving} id="btn-save-restaurant">
          {saving ? <span className="spinner" /> : <><Save size={16} /> Save</>}
        </button>
      </div>

      <div className={styles.scroll}>
        {/* Photos */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Restaurant Photos</p>
          <div className={styles.field}>
            <p className={styles.label}>Cover / Banner</p>
            <button className={styles.coverPicker} onClick={handlePickCover} disabled={uploadingCover}>
              {coverUrl ? <img src={coverUrl} alt="Cover" className={styles.coverImg} /> : <div className={styles.pickerPlaceholder}><ImageIcon size={32} color="var(--color-text-muted)" /><span className={styles.pickerText}>Add cover photo</span></div>}
              {uploadingCover && <div className={styles.pickerOverlay}><span className="spinner" /></div>}
            </button>
          </div>
          <div className={styles.field}>
            <p className={styles.label}>Logo / Profile Photo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className={styles.logoPicker} onClick={handlePickLogo} disabled={uploadingLogo}>
                {logoUrl ? <img src={logoUrl} alt="Logo" className={styles.logoImg} /> : <Camera size={26} color="var(--color-text-muted)" />}
                {uploadingLogo && <div className={styles.pickerOverlay}><span className="spinner" /></div>}
              </button>
              <p className={styles.pickerHint}>Square image recommended.{'\n'}Shows on your restaurant card.</p>
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Basic Info</p>
          {[{ label: 'Restaurant Name *', value: name, onChange: setName, placeholder: "e.g. Mama's Kitchen" },
            { label: 'Description', value: description, onChange: setDesc, placeholder: 'Tell customers what makes your restaurant special...', multiline: true },
          ].map(f => (
            <div key={f.label} className={styles.field}>
              <p className={styles.label}>{f.label}</p>
              {f.multiline ? <textarea className={styles.input} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} rows={3} /> : <input className={styles.input} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} />}
            </div>
          ))}
          <div className={styles.field}>
            <p className={styles.label}>Food Category</p>
            <div className={styles.catRow}>
              {FOOD_CATEGORIES.map(c => <button key={c} type="button" className={`${styles.catChip}${category===c?` ${styles.catChipActive}`:''}`} onClick={()=>setCategory(c)}>{c}</button>)}
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Contact</p>
          {[{ label: 'Phone Number *', value: phone, onChange: setPhone, placeholder: 'e.g. 0592649039', type: 'tel' },
            { label: 'WhatsApp (optional)', value: whatsapp, onChange: setWhatsapp, placeholder: 'e.g. 0592649039', type: 'tel' },
          ].map(f => <div key={f.label} className={styles.field}><p className={styles.label}>{f.label}</p><input className={styles.input} type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} /></div>)}
          <div className={styles.noteBox}><Info size={15} color="var(--color-text-muted)" /><p className={styles.noteText}>Customers see these numbers and call you directly to place orders.</p></div>
        </div>

        {/* Location & hours */}
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Location &amp; Hours</p>
          {[{ label: 'Address', value: address, onChange: setAddress, placeholder: 'Street / Area / Landmark' },
            { label: 'City', value: city, onChange: setCity, placeholder: 'e.g. Kumasi' },
          ].map(f => <div key={f.label} className={styles.field}><p className={styles.label}>{f.label}</p><input className={styles.input} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder} /></div>)}
          <div className={styles.field}>
            <p className={styles.label}>Opening Hours</p>
            <div className={styles.timePickerCard}>
              <TimeSlot label="Opens" hr={openHr} min={openMin} ampm={openAmPm} onHr={setOpenHr} onMin={setOpenMin} onAmPm={setOpenAmPm} />
              <div className={styles.timeDivider} />
              <TimeSlot label="Closes" hr={closeHr} min={closeMin} ampm={closeAmPm} onHr={setCloseHr} onMin={setCloseMin} onAmPm={setCloseAmPm} />
            </div>
            <p className={styles.timePreview}>Preview: {openHr}:{openMin} {openAmPm} – {closeHr}:{closeMin} {closeAmPm}</p>
          </div>
          <div className={styles.field}>
            <p className={styles.label}>Map Coordinates (optional)</p>
            <p className={styles.coordHint}>Used to sort your listing by distance for nearby customers. Leave blank if unsure.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className={styles.input} style={{ flex: 1 }} value={latStr} onChange={e => setLatStr(e.target.value)} placeholder="Latitude" />
              <input className={styles.input} style={{ flex: 1 }} value={lngStr} onChange={e => setLngStr(e.target.value)} placeholder="Longitude" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className={styles.statusCard}>
          <p className={styles.sectionTitle}>Account Status</p>
          <div className={styles.statusRow}><span>{restaurant.is_approved ? '✅' : '⏳'}</span><span className={styles.statusText}>{restaurant.is_approved ? 'Approved by admin' : 'Pending admin approval'}</span></div>
          <div className={styles.statusRow}><span>{subActive ? '💳' : '❌'}</span><span className={styles.statusText}>{subActive ? `Active — expires ${new Date(restaurant.subscription_expires_at!).toLocaleDateString()}` : 'No active subscription'}</span></div>
        </div>
      </div>
    </div>
  );
}
