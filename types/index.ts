// ================================================================
// DiDi Food Marketplace — Types
// Menu listing platform: customers browse & call to order.
// ================================================================

export type UserRole = 'customer' | 'vendor' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

// ── Subscription ─────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  description: string | null;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface VendorSubscription {
  id: string;
  vendor_id: string;
  restaurant_id: string;
  plan_id: string | null;
  assigned_by: string | null;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  notes: string | null;
  created_at: string;
  plan?: SubscriptionPlan;
}

// ── Restaurant ───────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address: string | null;
  city: string;
  phone: string;           // required — shown to customers
  whatsapp: string | null;
  food_category: string;
  opening_hours: string;
  is_open: boolean;
  is_approved: boolean;
  subscription_expires_at: string | null;
  rating: number;
  rating_count: number;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  updated_at: string;
  /** Client-side: distance from user (km) when location sorting is active */
  distanceKm?: number | null;
  /** Client-side: within nearby radius (~10 km) when sorted by proximity */
  isNearby?: boolean;
  // joined
  vendor?: Profile;
  subscription?: VendorSubscription;
  menu_items?: MenuItem[];
}

// ── Category ─────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

// ── Menu Item ────────────────────────────────────────────────────

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;          // primary / cover image
  image_urls: string[];              // up to 3 extra images (4 total)
  is_available: boolean;
  sort_order: number;
  created_at: string;
  category?: Category;
}

// ── Item Review ───────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ItemReview {
  id: string;
  item_id: string;
  customer_id: string;
  rating: number;          // 1–5
  body: string;
  image_urls: string[];    // up to 3 customer-uploaded photos
  status: ReviewStatus;
  admin_note: string | null;
  created_at: string;
  // joined
  customer?: Pick<Profile, 'id' | 'full_name' | 'phone'>;
  item?: Pick<MenuItem, 'id' | 'name'>;
  replies?: ReviewReply[];
}

// ── Review Reply ─────────────────────────────────────────────────

export interface ReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  // joined
  user?: Pick<Profile, 'id' | 'full_name'>;
}
