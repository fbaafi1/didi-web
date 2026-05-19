import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { Profile, Restaurant } from '@/types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  restaurant: Restaurant | null;
  isLoading: boolean;
  isAdmin: boolean;
  isVendor: boolean;
  isCustomer: boolean;
  setSession: (session: Session | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  fetchVendorRestaurant: (vendorId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  restaurant: null,
  isLoading: true,
  isAdmin: false,
  isVendor: false,
  isCustomer: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null, isLoading: !!session?.user });
    if (session?.user) {
      get().fetchProfile(session.user.id);
    } else {
      set({ isLoading: false, profile: null, isAdmin: false, isVendor: false, isCustomer: false, restaurant: null });
    }
  },

  fetchProfile: async (userId) => {
    const currentUser = get().user;
    const fallbackName =
      currentUser?.user_metadata?.full_name ??
      currentUser?.email?.split('@')[0] ??
      'Customer';
    const fallbackRole =
      currentUser?.user_metadata?.role === 'admin' || currentUser?.user_metadata?.role === 'vendor'
        ? currentUser.user_metadata.role
        : 'customer';

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const hydratedProfile: Profile = {
        ...data,
        full_name: data.full_name ?? fallbackName,
      };

      set({
        profile: hydratedProfile,
        isAdmin:    hydratedProfile.role === 'admin',
        isVendor:   hydratedProfile.role === 'vendor',
        isCustomer: hydratedProfile.role === 'customer',
        isLoading: false,
      });

      // Heal legacy rows that may be missing full_name.
      if (!data.full_name) {
        await supabase.from('profiles').upsert(
          { id: userId, full_name: fallbackName },
          { onConflict: 'id' }
        );
      }

      if (hydratedProfile.role === 'vendor') get().fetchVendorRestaurant(userId);
    } else {
      // Fallback profile to keep UI useful even if profiles query fails.
      const fallbackProfile: Profile = {
        id: userId,
        role: fallbackRole,
        full_name: fallbackName,
        phone: currentUser?.user_metadata?.phone ?? null,
        created_at: new Date().toISOString(),
      };

      set({
        profile: fallbackProfile,
        isAdmin: fallbackRole === 'admin',
        isVendor: fallbackRole === 'vendor',
        isCustomer: fallbackRole === 'customer',
        isLoading: false,
      });

      // Try to self-heal missing profile rows.
      await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: fallbackName,
          role: fallbackRole,
          phone: currentUser?.user_metadata?.phone ?? null,
        },
        { onConflict: 'id' }
      );
    }
  },

  fetchVendorRestaurant: async (vendorId) => {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .eq('vendor_id', vendorId)
      .single();
    if (data) set({ restaurant: data });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, restaurant: null, isAdmin: false, isVendor: false, isCustomer: false });
  },
}));
