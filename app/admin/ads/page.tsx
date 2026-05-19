'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, EyeOff, Pencil, Trash2, Video, Image } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { pickAndUploadMedia } from '@/utils/imageUpload';
import styles from './ads.module.css';

interface Ad { id: string; title: string | null; video_url: string | null; image_urls: string[]; link_url: string | null; starts_at: string; expires_at: string; is_active: boolean; sort_order: number; created_at: string; }
type AdStatus = 'live' | 'scheduled' | 'expired' | 'inactive';

function getAdStatus(ad: Ad): AdStatus {
  if (!ad.is_active) return 'inactive';
  const now = new Date(), start = new Date(ad.starts_at), end = new Date(ad.expires_at);
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  return 'live';
}
const STATUS_COLORS: Record<AdStatus, string> = { live: '#22C55E', scheduled: '#F59E0B', expired: '#EF4444', inactive: '#6B7280' };
const PRESETS = [{ label: '1 Day', days: 1 }, { label: '3 Days', days: 3 }, { label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }];
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

export default function AdminAdsPage() {
  const { profile } = useAuthStore();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [startsAt, setStartsAt] = useState(fmtDate(new Date()));
  const [expiresAt, setExpiresAt] = useState(fmtDate(addDays(new Date(), 7)));
  const [isActive, setIsActive] = useState(true);

  const fetchAds = useCallback(async () => {
    const { data } = await supabase.from('ads').select('*').order('sort_order', { ascending: true });
    if (data) setAds(data as Ad[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  const openAdd = () => { setEditing(null); setTitle(''); setVideoUrl(''); setImageUrls([]); setLinkUrl(''); setStartsAt(fmtDate(new Date())); setExpiresAt(fmtDate(addDays(new Date(), 7))); setIsActive(true); setModal(true); };
  const openEdit = (ad: Ad) => { setEditing(ad); setTitle(ad.title ?? ''); setVideoUrl(ad.video_url ?? ''); setImageUrls(ad.image_urls ?? []); setLinkUrl(ad.link_url ?? ''); setStartsAt(ad.starts_at.slice(0, 10)); setExpiresAt(ad.expires_at.slice(0, 10)); setIsActive(ad.is_active); setModal(true); };

  const handlePickVideo = async () => {
    setUploadingVideo(true);
    const result = await pickAndUploadMedia(`ad-video-${Date.now()}`);
    if (result) { if (result.type === 'video') setVideoUrl(result.url); else alert('Please pick a video file.'); }
    setUploadingVideo(false);
  };

  const handleAddImage = async () => {
    setUploadingImg(true);
    const result = await pickAndUploadMedia(`ad-img-${Date.now()}`);
    if (result) { if (result.type === 'image') setImageUrls(prev => [...prev, result.url]); else alert('Please pick an image.'); }
    setUploadingImg(false);
  };

  const handleSave = async () => {
    if (!videoUrl && imageUrls.length === 0) { alert('Upload a video and/or at least one image.'); return; }
    if (!startsAt || !expiresAt) { alert('Set both start and expiry dates.'); return; }
    if (new Date(expiresAt) <= new Date(startsAt)) { alert('Expiry must be after start date.'); return; }
    setSaving(true);
    const payload = { title: title.trim() || null, video_url: videoUrl || null, image_urls: imageUrls, link_url: linkUrl.trim() || null, starts_at: new Date(startsAt).toISOString(), expires_at: new Date(expiresAt + 'T23:59:59').toISOString(), is_active: isActive, created_by: profile?.id ?? null };
    const { error } = editing ? await supabase.from('ads').update(payload).eq('id', editing.id) : await supabase.from('ads').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setModal(false); fetchAds();
  };

  const handleDelete = async (ad: Ad) => {
    if (!confirm(`Remove "${ad.title ?? 'this ad'}"?`)) return;
    await supabase.from('ads').delete().eq('id', ad.id); fetchAds();
  };

  const toggleActive = async (ad: Ad) => { await supabase.from('ads').update({ is_active: !ad.is_active }).eq('id', ad.id); fetchAds(); };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div><h1 className={styles.headerTitle}>Ad Manager</h1><p className={styles.headerSub}>{ads.length} ad{ads.length !== 1 ? 's' : ''}</p></div>
        <button className={styles.addBtn} onClick={openAdd} id="btn-new-ad"><Plus size={20} /> New Ad</button>
      </div>

      {loading ? <div className="page-loader"><span className="spinner spinner--primary" /></div>
        : ads.length === 0 ? (
          <div className={styles.empty}>
            <span style={{ fontSize: 48 }}>📣</span>
            <p className={styles.emptyTitle}>No ads yet</p>
            <p className={styles.emptySub}>Create an ad with a video + images to display on the homepage</p>
            <button className={styles.emptyBtn} onClick={openAdd}>Create Ad</button>
          </div>
        ) : (
          <div className={styles.list}>
            {ads.map(ad => {
              const status = getAdStatus(ad);
              const sc = STATUS_COLORS[status];
              return (
                <div key={ad.id} className={styles.adCard}>
                  <div className={styles.thumbRow}>
                    <div className={`${styles.thumb} ${styles.thumbVideo}`}>
                      {ad.video_url ? <Video size={22} color="#fff" /> : <Video size={18} color="var(--color-text-muted)" />}
                      <span className={styles.thumbLabel}>Video</span>
                    </div>
                    {ad.image_urls?.[0] ? <img src={ad.image_urls[0]} alt="" className={styles.thumb} /> : (
                      <div className={`${styles.thumb} ${styles.thumbEmpty}`}><Image size={18} color="var(--color-text-muted)" /><span className={styles.thumbLabel}>No img</span></div>
                    )}
                    {(ad.image_urls?.length ?? 0) > 1 && <div className={styles.moreImages}>+{ad.image_urls.length - 1}</div>}
                  </div>
                  <div className={styles.adInfo}>
                    <div className={styles.adTitleRow}>
                      <p className={styles.adTitle}>{ad.title ?? 'Untitled Ad'}</p>
                      <span className={styles.statusBadge} style={{ background: sc + '22', color: sc }}><span className={styles.statusDot} style={{ background: sc }} />{status}</span>
                    </div>
                    <p className={styles.adMeta}>{ad.video_url ? '✅ Video' : '❌ No video'} · {ad.image_urls?.length ?? 0} image{(ad.image_urls?.length ?? 0) !== 1 ? 's' : ''}</p>
                    <p className={styles.adDate}>Expires {new Date(ad.expires_at).toLocaleDateString()}</p>
                  </div>
                  <div className={styles.adActions}>
                    <button className={styles.iconBtn} onClick={() => toggleActive(ad)} title={ad.is_active ? 'Deactivate' : 'Activate'}>{ad.is_active ? <Eye size={16} color="var(--color-success)" /> : <EyeOff size={16} color="var(--color-text-muted)" />}</button>
                    <button className={styles.iconBtn} onClick={() => openEdit(ad)} title="Edit"><Pencil size={16} color="var(--color-primary)" /></button>
                    <button className={styles.iconBtn} onClick={() => handleDelete(ad)} title="Delete"><Trash2 size={16} color="var(--color-error)" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {modal && (
        <div className={styles.modalOverlay} onClick={() => setModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <p className={styles.modalTitle}>{editing ? 'Edit Ad' : 'New Ad'}</p>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24 }}>✕</button>
            </div>
            <div className={styles.modalForm}>
              <div className={styles.layoutInfo}>
                <div className={styles.layoutHalf}><Video size={18} color="#7C3AED" /><span className={styles.layoutHalfText}>Left panel{'\n'}Video</span></div>
                <div className={styles.layoutDivider} />
                <div className={styles.layoutHalf}><Image size={18} color="var(--color-primary)" /><span className={styles.layoutHalfText}>Right panel{'\n'}Sliding images</span></div>
              </div>

              <div className={styles.field}>
                <p className={styles.fieldLabel}>📹 Video (left panel)</p>
                <button className={`${styles.uploadBtn}${uploadingVideo ? ' disabled' : ''}`} onClick={handlePickVideo} disabled={uploadingVideo}>
                  {uploadingVideo ? <span className="spinner" /> : <Video size={18} />} {uploadingVideo ? 'Uploading…' : videoUrl ? 'Replace Video' : 'Upload Video'}
                </button>
                {videoUrl && <p className={styles.uploadedText}>✅ Video uploaded</p>}
              </div>

              <div className={styles.field}>
                <p className={styles.fieldLabel}>🖼 Images (right panel, slides every 3s)</p>
                {imageUrls.length > 0 && (
                  <div className={styles.imgPreviewRow}>
                    {imageUrls.map((url, i) => (
                      <div key={i} className={styles.imgPreviewWrap}>
                        <img src={url} alt="" className={styles.imgPreview} />
                        <button className={styles.imgRemoveBtn} onClick={() => setImageUrls(p => p.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button className={`${styles.uploadBtnSecondary}${uploadingImg ? ' disabled' : ''}`} onClick={handleAddImage} disabled={uploadingImg}>
                  {uploadingImg ? <span className="spinner spinner--primary" /> : <Image size={18} color="var(--color-primary)" />} {uploadingImg ? 'Uploading…' : `Add Image (${imageUrls.length} added)`}
                </button>
              </div>

              <div className={styles.field}>
                <p className={styles.fieldLabel}>Ad Title (optional)</p>
                <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekend Special 🔥" />
              </div>
              <div className={styles.field}>
                <p className={styles.fieldLabel}>Link URL (optional)</p>
                <input className={styles.input} value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className={styles.field}>
                <p className={styles.fieldLabel}>Goes Live (YYYY-MM-DD)</p>
                <input className={styles.input} type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
                <div className={styles.presetRow}>
                  <button className={styles.presetChip} onClick={() => setStartsAt(fmtDate(new Date()))}>Now</button>
                  <button className={styles.presetChip} onClick={() => setStartsAt(fmtDate(addDays(new Date(), 1)))}>Tomorrow</button>
                </div>
              </div>
              <div className={styles.field}>
                <p className={styles.fieldLabel}>Expires On (YYYY-MM-DD)</p>
                <input className={styles.input} type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                <div className={styles.presetRow}>
                  {PRESETS.map(p => { const val = fmtDate(addDays(new Date(startsAt), p.days)); return (<button key={p.days} className={`${styles.presetChip}${expiresAt === val ? ` ${styles.presetChipActive}` : ''}`} onClick={() => setExpiresAt(val)}>{p.label}</button>); })}
                </div>
              </div>
              <div className={styles.switchRow}>
                <div><p className={styles.fieldLabel}>Active</p><p className={styles.fieldSub}>Inactive ads never show</p></div>
                <label className={styles.toggle}><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /><span className={styles.toggleSlider} /></label>
              </div>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? <span className="spinner" /> : editing ? 'Save Changes' : 'Publish Ad'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
