'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';

/**
 * Client component that boots the Supabase auth listener once.
 * Replaces the useEffect in the Expo root _layout.tsx.
 * Rendered inside the root layout so it's always mounted.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession } = useAuthStore();

  useEffect(() => {
    // Hydrate session on mount
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
