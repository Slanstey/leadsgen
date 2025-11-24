import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type UserProfile = Tables<"user_profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, organizationName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);
  const fetchInProgressRef = useRef(false);

  const fetchUserProfile = async (userId: string) => {
    // Prevent concurrent fetches for the same user
    if (fetchInProgressRef.current && currentUserIdRef.current === userId) {
      return;
    }

    // If we already have the profile for this user, don't fetch again
    if (currentProfileIdRef.current === userId && currentUserIdRef.current === userId) {
      // Ensure loading is false since we already have the profile
      setLoading(false);
      return;
    }

    // Only set loading to true if we don't already have a profile
    // This prevents unnecessary loading states during token refreshes
    const shouldShowLoading = !currentProfileIdRef.current || currentProfileIdRef.current !== userId;

    try {
      fetchInProgressRef.current = true;
      currentUserIdRef.current = userId;
      if (shouldShowLoading) {
        setLoading(true);
      }

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Profile fetch timeout') }), 10000)
      );

      const fetchPromise = supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      const { data, error } = result;

      if (error) {
        console.error("Error fetching user profile:", error);
        // Don't set profile if there's an error, but stop loading
        setProfile(null);
        currentProfileIdRef.current = null;
        setLoading(false);
        return;
      }

      if (data) {
        setProfile(data);
        currentProfileIdRef.current = data.id;
        console.log('User profile fetched successfully:', data);
      } else {
        setProfile(null);
        currentProfileIdRef.current = null;
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setProfile(null);
      currentProfileIdRef.current = null;
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Error getting session:", error);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        currentUserIdRef.current = session.user.id;
        await fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
        currentUserIdRef.current = null;
        currentProfileIdRef.current = null;
      }
    }).catch((error) => {
      console.error("Error in getSession:", error);
      if (mounted) {
        setLoading(false);
        currentUserIdRef.current = null;
        currentProfileIdRef.current = null;
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Only fetch profile on actual auth events, not token refreshes
      // Token refreshes happen periodically and shouldn't trigger loading states
      const isTokenRefresh = event === 'TOKEN_REFRESHED';
      const isSignIn = event === 'SIGNED_IN';
      const isSignOut = event === 'SIGNED_OUT';
      const userId = session?.user?.id ?? null;
      const userChanged = userId !== currentUserIdRef.current;

      setSession(session);
      setUser(session?.user ?? null);

      if (isSignOut || !session?.user) {
        setProfile(null);
        setLoading(false);
        currentUserIdRef.current = null;
        currentProfileIdRef.current = null;
        fetchInProgressRef.current = false;
      } else if (!isTokenRefresh && (isSignIn || userChanged)) {
        // Only fetch if it's a real auth event and user changed
        currentUserIdRef.current = userId;
        await fetchUserProfile(userId);
      } else if (isTokenRefresh) {
        // Token refresh happened but user is the same - ensure loading is false
        // Don't fetch profile again, just ensure we're not in loading state
        // Only set loading to false if we already have a profile, otherwise don't change loading state
        if (currentProfileIdRef.current && currentProfileIdRef.current === userId) {
          setLoading(false);
        }
      } else {
        // Any other event - ensure loading is false if we have a profile
        if (currentProfileIdRef.current && currentProfileIdRef.current === userId && !fetchInProgressRef.current) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Check if email is verified
    if (data.user && !data.user.email_confirmed_at) {
      // Sign out the user immediately if email is not verified
      await supabase.auth.signOut();
      throw new Error("Please verify your email address before signing in. Check your inbox for the verification link.");
    }

    if (data.user) {
      await fetchUserProfile(data.user.id);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, organizationName: string) => {
    // Call backend signup endpoint which handles tenant creation/assignment
    // Backend uses service role key to bypass RLS and create tenants
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/api/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        organization_name: organizationName,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create account');
    }

    // Backend has created the user and assigned tenant
    // Note: Email verification is enabled, so user cannot sign in immediately
    // They need to verify their email first via the link sent to their inbox
    // We do NOT attempt to sign in here - user must verify email and sign in manually
  };

  const signOut = async () => {
    // Clear local state first to ensure UI updates immediately
    setProfile(null);
    setSession(null);
    setUser(null);
    setLoading(false);
    currentProfileIdRef.current = null;
    currentUserIdRef.current = null;
    fetchInProgressRef.current = false;

    try {
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        // Don't throw - we've already cleared local state
        // The user is effectively signed out locally even if Supabase call fails
      }
    } catch (error) {
      // Log error but don't throw - local state is already cleared
      console.error("Error during sign out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

