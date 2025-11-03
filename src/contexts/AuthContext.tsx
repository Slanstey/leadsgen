import { createContext, useContext, useEffect, useState } from "react";
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    console.log("=== fetchUserProfile called ===", userId);
    setLoading(true);
    
    try {
      console.log("Fetching profile for user:", userId);
      console.log("Current session:", await supabase.auth.getSession());
      
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      console.log("Profile fetch result:", { data, error });

      if (error) {
        console.error("Error fetching user profile - FULL ERROR:", JSON.stringify(error, null, 2));
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        
        // Check if it's a "not found" error (PGRST116) or other error
        if (error.code === 'PGRST116') {
          console.warn("User profile not found - trigger may not have created it yet");
          // Try waiting a bit and retrying once
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: retryData, error: retryError } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .single();
          
          console.log("Retry result:", { retryData, retryError });
          
          if (retryError || !retryData) {
            console.error("Profile still not found after retry:", retryError);
            setLoading(false);
            return;
          }
          
          console.log("Profile loaded on retry:", retryData);
          setProfile(retryData);
          setLoading(false);
          return;
        }
        
        // For any other error, still clear loading so user isn't stuck
        console.error("Profile fetch failed with error, clearing loading state");
        setLoading(false);
        return;
      }
      
      if (!data) {
        console.warn("User profile not found for user (no data):", userId);
        setLoading(false);
        return;
      }
      
      console.log("Profile loaded successfully:", data);
      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      console.error("Exception stack:", (error as Error).stack);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        throw error;
      }

      if (data.user) {
        await fetchUserProfile(data.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
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

