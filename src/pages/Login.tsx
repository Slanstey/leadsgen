import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signOut, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Force logout on mount to clear any stuck sessions
  useEffect(() => {
    console.log("Login component mounted - checking for existing session");
    const clearSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("Found existing session, clearing it...");
          await signOut();
          console.log("Session cleared");
        }
      } catch (error) {
        console.error("Error clearing session:", error);
      }
    };
    clearSession();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    console.log("Login useEffect - auth state:", { 
      authLoading, 
      hasUser: !!user, 
      hasProfile: !!profile,
      userEmail: user?.email,
      profileTenantId: profile?.tenant_id 
    });
    
    if (!authLoading && user && profile) {
      console.log("Redirecting to dashboard...");
      setLoading(false); // Reset local loading state
      navigate("/", { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  // Timeout protection - if loading takes too long, show error
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.error("Login timeout - profile loading took too long");
        setLoading(false);
        toast.error("Login is taking longer than expected. Please try again.");
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log("=== Login form submitted ===", email);

    try {
      console.log("Calling signIn...");
      await signIn(email, password);
      console.log("signIn completed, waiting for profile...");
      toast.success("Successfully signed in!");
      // Don't set loading to false here - let the useEffect handle redirect
      // The loading state will be managed by authLoading from AuthContext
    } catch (error: any) {
      console.error("Login error:", error);
      console.error("Login error details:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Failed to sign in");
      setLoading(false);
    }
  };

  // Show loading if we're redirecting after successful login
  // Show loading if: 
  // 1. We have a user but no profile yet (waiting for profile to load)
  // 2. We're currently submitting the form
  // But NOT if we're just checking initial auth state (no user, not loading form)
  const isLoadingAfterLogin = (user && !profile) || (loading && user);
  
  if (isLoadingAfterLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Signing you in...</p>
          <p className="text-xs text-muted-foreground mt-2">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">LeadFlow</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                console.log("Manual logout clicked");
                try {
                  await signOut();
                  await supabase.auth.signOut();
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                } catch (error) {
                  console.error("Logout error:", error);
                }
              }}
            >
              Clear Session & Reload
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

