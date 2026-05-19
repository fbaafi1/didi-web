'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Heart, Phone, MessageCircle, Clock, MapPin,
  Star, Camera, X, ChevronLeft, ChevronRight, Trash2, Send, MessageSquare,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { PLATFORM } from '@/constants/config';
import { getRestaurantStatus } from '@/utils/openingHours';
import { useFavorites } from '@/hooks/useFavorites';
import { cacheGet, cacheSet } from '@/utils/cache';
import { pickAndUploadReviewPhoto } from '@/utils/imageUpload';
import styles from './item.module.css';

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}

interface ItemDetail {
  id: string; name: string; description: string | null;
  price: number; image_url: string | null; image_urls: string[]; is_available: boolean;
  restaurant: {
    id: string; name: string; description: string | null; city: string; address: string | null;
    food_category: string; logo_url: string | null; cover_url: string | null;
    is_open: boolean; opening_hours: string; phone: string; whatsapp: string | null; rating: number;
  };
}

interface Review {
  id: string; rating: number; body: string; created_at: string; customer_id: string;
  image_urls: string[];
  customer?: { id: string; full_name: string };
  replies?: Reply[];
}

interface Reply {
  id: string; body: string; created_at: string; user_id: string;
  user?: { id: string; full_name: string };
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { user } = useAuthStore();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIdx, setLbIdx] = useState(0);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(5);
  const [draftBody, setDraftBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ reviewId: string; name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [draftPhotos, setDraftPhotos] = useState<(string | null)[]>([null, null, null]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const cacheKey = `item:${id}`;
      const cached = cacheGet<ItemDetail>(cacheKey);
      if (cached) { setItem(cached); setLoading(false); }
      try {
        const { data } = await supabase.from('menu_items').select(`
          id, name, description, price, image_url, image_urls, is_available,
          restaurant:restaurants(id, name, description, city, address, food_category,
            logo_url, cover_url, is_open, opening_hours, phone, whatsapp, rating)
        `).eq('id', id).single();
        if (data) { setItem(data as unknown as ItemDetail); cacheSet(cacheKey, data); }
      } catch { /* keep cache */ }
      setLoading(false);
    };
    load();
  }, [id]);

  const fetchReviews = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('item_reviews')
      .select('*, customer:profiles(id, full_name), replies:review_replies(*, user:profiles(id, full_name))')
      .eq('item_id', id).order('created_at', { ascending: false });
    setReviews((data ?? []) as Review[]);
    if (user) {
      const { data: mine } = await supabase.from('item_reviews').select('*')
        .eq('item_id', id).eq('customer_id', user.id).maybeSingle();
      setMyReview(mine as Review | null);
    }
  }, [id, user]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handlePickPhoto = async (slot: number) => {
    if (!user) return;
    setUploadingSlot(slot);
    const url = await pickAndUploadReviewPhoto(user.id);
    if (url) setDraftPhotos(prev => { const n = [...prev]; n[slot] = url; return n; });
    setUploadingSlot(null);
  };

  const ensureProfile = async () => {
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!p) {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User',
        role: user.user_metadata?.role ?? 'customer',
        phone: user.user_metadata?.phone ?? null,
      }, { onConflict: 'id' });
    }
  };

  const submitReview = async () => {
    if (!user || !item) return;
    if (draftBody.trim().length < 10) { alert('Please write at least 10 characters.'); return; }
    setSubmitting(true);
    await ensureProfile();
    const { error } = await supabase.from('item_reviews').insert({
      item_id: item.id, customer_id: user.id, rating: draftRating,
      body: draftBody.trim(), image_urls: draftPhotos.filter(Boolean) as string[],
    });
    setSubmitting(false);
    if (error) { alert(error.message); return; }
    setDraftBody(''); setDraftPhotos([null, null, null]); setReplyingTo(null);
    alert('Posted! 🎉 Your comment is now live.');
    fetchReviews();
  };

  const submitReply = async () => {
    if (!user || !replyingTo) return;
    if (draftBody.trim().length < 2) { alert('Please write at least 2 characters.'); return; }
    setSubmitting(true);
    await ensureProfile();
    const { error } = await supabase.from('review_replies').insert({
      review_id: replyingTo.reviewId, user_id: user.id, body: draftBody.trim(),
    });
    setSubmitting(false);
    if (error) { alert(error.message); return; }
    setDraftBody(''); setReplyingTo(null);
    setExpandedReplies(prev => new Set(prev).add(replyingTo!.reviewId));
    fetchReviews();
  };

  if (loading) return <div className="page-loader"><span className="spinner spinner--primary" /></div>;
  if (!item) return <div className={styles.center}><p style={{ color: 'var(--color-text-muted)' }}>Item not found.</p></div>;

  const { restaurant: r } = item;
  const { isOpen, opensAt } = getRestaurantStatus(r.opening_hours);
  const allPhotos = [...(item.image_url ? [item.image_url] : []), ...(Array.isArray(item.image_urls) ? item.image_urls : [])];

  const handleCall = () => window.open(`tel:${r.phone.replace(/\D/g, '')}`, '_self');
  const handleWhatsApp = () => {
    const digits = (r.whatsapp || r.phone).replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `233${digits.slice(1)}` : digits;
    const msg = encodeURIComponent(`Hi! I'd like to order ${item.name} (₵${item.price.toFixed(2)}) from your restaurant on ${PLATFORM.name}.`);
    window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
  };

  return (
    <div className={styles.page}>
      {/* Lightbox */}
      {lbOpen && (
        <div className={styles.lightbox} onClick={() => setLbOpen(false)}>
          <button className={styles.lbClose} onClick={() => setLbOpen(false)}><X size={26} color="#fff" /></button>
          {allPhotos.length > 1 && <p className={styles.lbCounter}>{lbIdx + 1} / {allPhotos.length}</p>}
          <img src={allPhotos[lbIdx]} alt={item.name} className={styles.lbImage} onClick={e => e.stopPropagation()} />
          {lbIdx > 0 && <button className={`${styles.lbArrow} ${styles.lbArrowLeft}`} onClick={e => { e.stopPropagation(); setLbIdx(i => i - 1); }}><ChevronLeft size={28} color="#fff" /></button>}
          {lbIdx < allPhotos.length - 1 && <button className={`${styles.lbArrow} ${styles.lbArrowRight}`} onClick={e => { e.stopPropagation(); setLbIdx(i => i + 1); }}><ChevronRight size={28} color="#fff" /></button>}
          {allPhotos.length > 1 && (
            <div className={styles.lbDots}>
              {allPhotos.map((_, i) => <button key={i} className={`${styles.lbDot}${i === lbIdx ? ` ${styles.lbDotActive}` : ''}`} onClick={e => { e.stopPropagation(); setLbIdx(i); }} />)}
            </div>
          )}
        </div>
      )}

      {/* Comments sheet */}
      {commentsOpen && (
        <div className={styles.sheetOverlay} onClick={() => setCommentsOpen(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>{reviews.length > 0 ? `${reviews.length} comment${reviews.length !== 1 ? 's' : ''}` : 'Comments'}</span>
              <button onClick={() => setCommentsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={24} /></button>
            </div>

            <div className={styles.commentList}>
              {reviews.length === 0 ? (
                <div className={styles.emptyComments}>
                  <span style={{ fontSize: 36 }}>💬</span>
                  <p className={styles.emptyCommentsTitle}>No comments yet</p>
                  <p className={styles.emptyCommentsSub}>Be the first to share your experience!</p>
                </div>
              ) : reviews.map(rv => {
                const hasReplies = (rv.replies?.length ?? 0) > 0;
                const isExpanded = expandedReplies.has(rv.id);
                return (
                  <div key={rv.id}>
                    <div className={styles.comment}>
                      <div className={styles.commentAvatar}><span>{(rv.customer?.full_name ?? '?')[0].toUpperCase()}</span></div>
                      <div className={styles.commentContent}>
                        <div className={styles.commentNameRow}>
                          <span className={styles.commentName}>{rv.customer?.full_name ?? 'Anonymous'}</span>
                          <span className={styles.commentTime}>{getTimeAgo(rv.created_at)}</span>
                        </div>
                        <div className={styles.commentStars}>{'★'.repeat(rv.rating).padEnd(5, '☆')}</div>
                        <p className={styles.commentBody}>{rv.body}</p>
                        {(rv.image_urls?.length ?? 0) > 0 && (
                          <div className={styles.commentPhotos}>
                            {rv.image_urls.map((url, pi) => <img key={pi} src={url} alt="" className={styles.commentPhoto} />)}
                          </div>
                        )}
                        <div className={styles.commentActions}>
                          <button className={styles.replyBtn} onClick={() => {
                            if (!user) { router.push(`/auth/login?returnTo=/customer/item/${id}`); return; }
                            setReplyingTo({ reviewId: rv.id, name: rv.customer?.full_name ?? 'Anonymous' });
                            setDraftBody('');
                          }}>
                            <MessageSquare size={13} /> Reply
                          </button>
                          {hasReplies && (
                            <button className={styles.viewRepliesBtn} onClick={() => setExpandedReplies(prev => {
                              const next = new Set(prev);
                              if (next.has(rv.id)) next.delete(rv.id); else next.add(rv.id);
                              return next;
                            })}>
                              {isExpanded ? 'Hide replies' : `View ${rv.replies!.length} repl${rv.replies!.length === 1 ? 'y' : 'ies'}`}
                            </button>
                          )}
                          {user && rv.customer_id === user.id && (
                            <button className={styles.deleteBtn} onClick={async () => {
                              if (!confirm('Delete this comment?')) return;
                              await supabase.from('item_reviews').delete().eq('id', rv.id);
                              setMyReview(null); fetchReviews();
                            }}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded && rv.replies?.map(reply => (
                      <div key={reply.id} className={styles.reply}>
                        <div className={styles.replyLine} />
                        <div className={styles.replyAvatar}>{(reply.user?.full_name ?? '?')[0].toUpperCase()}</div>
                        <div className={styles.replyContent}>
                          <div className={styles.commentNameRow}>
                            <span className={styles.commentName}>{reply.user?.full_name ?? 'User'}</span>
                            <span className={styles.commentTime}>{getTimeAgo(reply.created_at)}</span>
                          </div>
                          <p className={styles.commentBody}>{reply.body}</p>
                        </div>
                        {user && reply.user_id === user.id && (
                          <button className={styles.deleteBtn} onClick={async () => {
                            if (!confirm('Delete reply?')) return;
                            await supabase.from('review_replies').delete().eq('id', reply.id); fetchReviews();
                          }}><Trash2 size={13} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Compose bar */}
            <div className={styles.compose}>
              {replyingTo && (
                <div className={styles.replyingBar}>
                  <span>Replying to <strong style={{ color: 'var(--color-primary)' }}>@{replyingTo.name}</strong></span>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                </div>
              )}
              {!replyingTo && !myReview && (
                <div className={styles.starRow}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setDraftRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: s <= draftRating ? '#FFB800' : 'var(--color-border)' }}>★</button>
                  ))}
                </div>
              )}
              {!replyingTo && !myReview && (
                <div className={styles.photoSlots}>
                  {draftPhotos.map((url, slot) => (
                    <button key={slot} className={styles.photoSlot} onClick={() => url ? setDraftPhotos(p => { const n=[...p]; n[slot]=null; return n; }) : handlePickPhoto(slot)}>
                      {uploadingSlot === slot ? <span className="spinner" /> : url ? <img src={url} alt="" className={styles.photoSlotImg} /> : <Camera size={18} color="var(--color-text-muted)" />}
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.composeRow}>
                <input
                  className={styles.composeInput}
                  placeholder={replyingTo ? `Reply to @${replyingTo.name}...` : myReview ? 'You already reviewed this item' : 'Share your experience...'}
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  disabled={!!myReview && !replyingTo}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); replyingTo ? submitReply() : submitReview(); } }}
                />
                <button className={styles.sendBtn} onClick={replyingTo ? submitReply : submitReview} disabled={submitting || (!!myReview && !replyingTo)}>
                  {submitting ? <span className="spinner" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className={styles.scroll}>
        {/* Hero image */}
        <div className={styles.heroWrap}>
          {allPhotos.length > 0 ? (
            <>
              <img src={allPhotos[imgIdx]} alt={item.name} className={styles.heroImage} onClick={() => { setLbIdx(imgIdx); setLbOpen(true); }} />
              {allPhotos.length > 1 && imgIdx > 0 && (
                <button className={`${styles.heroArrow} ${styles.heroArrowLeft}`} onClick={() => setImgIdx(i => i - 1)}><ChevronLeft size={22} color="#fff" /></button>
              )}
              {allPhotos.length > 1 && imgIdx < allPhotos.length - 1 && (
                <button className={`${styles.heroArrow} ${styles.heroArrowRight}`} onClick={() => setImgIdx(i => i + 1)}><ChevronRight size={22} color="#fff" /></button>
              )}
              {allPhotos.length > 1 && (
                <div className={styles.heroDots}>
                  {allPhotos.map((_, i) => <button key={i} className={`${styles.heroDot}${i === imgIdx ? ` ${styles.heroDotActive}` : ''}`} onClick={() => setImgIdx(i)} />)}
                </div>
              )}
              {allPhotos.length > 1 && <div className={styles.heroCounter}>{imgIdx + 1} / {allPhotos.length}</div>}
            </>
          ) : (
            <div className={styles.heroPlaceholder}>🍽️</div>
          )}

          <button className={styles.backBtn} onClick={() => router.back()}><ArrowLeft size={22} color="#fff" /></button>
          <button className={styles.favBtn} onClick={() => toggleFavorite(id)}>
            <Heart size={22} fill={isFavorite(id) ? '#FF4D6A' : 'none'} color={isFavorite(id) ? '#FF4D6A' : '#fff'} />
          </button>
          {!item.is_available && <div className={styles.unavailBadge}>Currently Unavailable</div>}
        </div>

        {/* Food info */}
        <div className={styles.section}>
          <div className={styles.itemHeader}>
            <h1 className={styles.itemName}>{item.name}</h1>
            <p className={styles.itemPrice}>₵{item.price.toFixed(2)}</p>
          </div>
          {item.description && <p className={styles.itemDesc}>{item.description}</p>}
        </div>

        <div className={styles.divider} />

        {/* Restaurant card */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Sold by</p>
          <Link href={`/customer/restaurant/${r.id}`} className={styles.restCard}>
            {r.cover_url ? <img src={r.cover_url} alt="" className={styles.restCover} /> : <div className={styles.restCoverPlaceholder} />}
            <div className={styles.restLogoWrap}>
              {r.logo_url ? <img src={r.logo_url} alt="" className={styles.restLogo} /> : (
                <div className={styles.restLogoPlaceholder}>{r.name[0].toUpperCase()}</div>
              )}
            </div>
            <div className={styles.restInfo}>
              <div className={styles.restNameRow}>
                <span className={styles.restName}>{r.name}</span>
                <span className={`${styles.openBadge}${!isOpen ? ` ${styles.closedBadge}` : ''}`}>
                  <span className={`${styles.openDot}${!isOpen ? ` ${styles.closedDot}` : ''}`} />
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              {r.description && <p className={styles.restDesc}>{r.description}</p>}
              <div className={styles.restMeta}><MapPin size={13} /> {r.address ? `${r.address}, ${r.city}` : r.city}</div>
              <div className={styles.restMeta}><Clock size={13} /> {r.opening_hours}</div>
              {r.rating > 0 && <div className={styles.restMeta}><Star size={13} color="#FFB800" /> {r.rating.toFixed(1)} rating</div>}
            </div>
          </Link>
        </div>

        {/* Comment trigger */}
        <button className={styles.commentTrigger} onClick={() => setCommentsOpen(true)}>
          <div className={styles.commentTriggerLeft}>
            <div className={styles.stackedAvatars}>
              {reviews.slice(0, 3).map((rv, i) => (
                <div key={rv.id} className={styles.stackedAvatar} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }}>
                  {(rv.customer?.full_name ?? '?')[0].toUpperCase()}
                </div>
              ))}
              {reviews.length === 0 && <div className={styles.stackedAvatar}><MessageSquare size={14} /></div>}
            </div>
            <div>
              <p className={styles.commentTriggerTitle}>
                {reviews.length > 0 ? `${reviews.length} comment${reviews.length !== 1 ? 's' : ''}` : 'Be the first to comment'}
              </p>
              {reviews.length > 0 && (
                <p className={styles.commentTriggerSub}>
                  {reviews[0].customer?.full_name ?? 'Someone'}: {reviews[0].body.substring(0, 40)}{reviews[0].body.length > 40 ? '…' : ''}
                </p>
              )}
            </div>
          </div>
          <div className={styles.commentTriggerRight}>
            {reviews.flatMap(rv => rv.image_urls ?? []).slice(0, 2).map((url, i) => (
              <img key={i} src={url} alt="" className={styles.commentPreviewPhoto} />
            ))}
            <ChevronRight size={18} color="var(--color-text-muted)" />
          </div>
        </button>
      </div>

      {/* Fixed action buttons */}
      <div className={styles.actionBar}>
        <button id="btn-call" className={styles.callBtn} onClick={handleCall}>
          <Phone size={20} /> Call to Order
        </button>
        <button id="btn-whatsapp" className={styles.waBtn} onClick={handleWhatsApp}>
          <MessageCircle size={20} /> WhatsApp
        </button>
      </div>
    </div>
  );
}
