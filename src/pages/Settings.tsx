import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [linkedinConnecting, setLinkedinConnecting] = useState(false);
  const [linkedinDisconnecting, setLinkedinDisconnecting] = useState(false);
  const [linkedinProfile, setLinkedinProfile] = useState<{
    profile_id: string | null;
    profile_url: string | null;
    first_name: string | null;
    last_name: string | null;
    headline: string | null;
    connected_at: string | null;
  } | null>(null);

  // Load LinkedIn profile
  useEffect(() => {
    const loadLinkedInProfile = async () => {
      if (!profile?.id) {
        setLoading(false);
        return;
      }

      // Check for LinkedIn OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        toast.error(`LinkedIn connection failed: ${error}`);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (code && state) {
        // Handle LinkedIn OAuth callback
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast.error("You must be logged in to complete LinkedIn connection");
            setLoading(false);
            return;
          }

          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
          
          const response = await fetch(`${backendUrl}/api/linkedin/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              code,
              state,
              user_id: profile.id,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || 'Unknown error' };
            }
            throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          
          if (data.success) {
            // Reload LinkedIn profile data
            const { data: userProfile, error: profileError } = await supabase
              .from("user_profiles")
              .select("linkedin_profile_id, linkedin_profile_url, linkedin_first_name, linkedin_last_name, linkedin_headline, linkedin_connected_at")
              .eq("id", profile.id)
              .single();

            if (!profileError && userProfile?.linkedin_profile_id) {
              setLinkedinProfile({
                profile_id: userProfile.linkedin_profile_id,
                profile_url: userProfile.linkedin_profile_url,
                first_name: userProfile.linkedin_first_name,
                last_name: userProfile.linkedin_last_name,
                headline: userProfile.linkedin_headline,
                connected_at: userProfile.linkedin_connected_at,
              });
            }

            toast.success("LinkedIn account connected successfully!");
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            toast.error(data.error || "Failed to connect LinkedIn account");
          }
        } catch (error) {
          console.error("Error handling LinkedIn callback:", error);
          toast.error(error instanceof Error ? error.message : "Failed to complete LinkedIn connection");
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      try {
        // Load LinkedIn profile connection status
        const { data: userProfile, error: profileError } = await supabase
          .from("user_profiles")
          .select("linkedin_profile_id, linkedin_profile_url, linkedin_first_name, linkedin_last_name, linkedin_headline, linkedin_connected_at")
          .eq("id", profile.id)
          .single();

        if (!profileError && userProfile) {
          if (userProfile.linkedin_profile_id) {
            setLinkedinProfile({
              profile_id: userProfile.linkedin_profile_id,
              profile_url: userProfile.linkedin_profile_url,
              first_name: userProfile.linkedin_first_name,
              last_name: userProfile.linkedin_last_name,
              headline: userProfile.linkedin_headline,
              connected_at: userProfile.linkedin_connected_at,
            });
          }
        }
      } catch (error) {
        console.error("Error loading LinkedIn profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadLinkedInProfile();
  }, [profile]);


  const handleConnectLinkedIn = async () => {
    if (!profile?.id) {
      toast.error("You must be logged in to connect LinkedIn");
      return;
    }

    setLinkedinConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to connect LinkedIn");
        setLinkedinConnecting(false);
        return;
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      
      // Initiate LinkedIn OAuth flow
      // This will redirect to LinkedIn for authorization
      const response = await fetch(`${backendUrl}/api/linkedin/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
          redirect_uri: `${window.location.origin}/settings`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.auth_url) {
        // Redirect to LinkedIn OAuth
        window.location.href = data.auth_url;
      } else {
        toast.error("Failed to initiate LinkedIn connection");
      }
    } catch (error) {
      console.error("Error connecting LinkedIn:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect LinkedIn");
      setLinkedinConnecting(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    if (!profile?.id) {
      toast.error("You must be logged in to disconnect LinkedIn");
      return;
    }

    setLinkedinDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to disconnect LinkedIn");
        setLinkedinDisconnecting(false);
        return;
      }

      // Clear LinkedIn data from user profile
      const { error } = await supabase
        .from("user_profiles")
        .update({
          linkedin_access_token: null,
          linkedin_refresh_token: null,
          linkedin_profile_id: null,
          linkedin_profile_url: null,
          linkedin_first_name: null,
          linkedin_last_name: null,
          linkedin_headline: null,
          linkedin_connected_at: null,
          linkedin_token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        throw error;
      }

      setLinkedinProfile(null);
      toast.success("LinkedIn account disconnected successfully");
    } catch (error: any) {
      console.error("Error disconnecting LinkedIn:", error);
      const errorMessage = error?.message || error?.error || "Failed to disconnect LinkedIn";
      toast.error(errorMessage);
    } finally {
      setLinkedinDisconnecting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your LinkedIn account connection</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* LinkedIn Connection Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>LinkedIn Account Connection</CardTitle>
            <CardDescription>
              Connect your LinkedIn account to access your network, view potential leads, and manage warm introductions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkedinProfile?.profile_id ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between p-4 border rounded-lg bg-muted/50">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                        {(linkedinProfile.first_name?.[0] || "") + (linkedinProfile.last_name?.[0] || "")}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {linkedinProfile.first_name} {linkedinProfile.last_name}
                        </p>
                        {linkedinProfile.headline && (
                          <p className="text-sm text-muted-foreground">{linkedinProfile.headline}</p>
                        )}
                      </div>
                    </div>
                    {linkedinProfile.profile_url && (
                      <a
                        href={linkedinProfile.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        View LinkedIn Profile
                      </a>
                    )}
                    {linkedinProfile.connected_at && (
                      <p className="text-xs text-muted-foreground">
                        Connected on {new Date(linkedinProfile.connected_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleDisconnectLinkedIn}
                    disabled={linkedinDisconnecting}
                    className="gap-2"
                  >
                    {linkedinDisconnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unlink className="h-4 w-4" />
                        Disconnect
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Connected!</strong> Your LinkedIn account is connected. You can now use your network to find leads and manage warm introductions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                  <Link2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Connect Your LinkedIn Account</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your LinkedIn account to access your professional network, view potential leads in your network, and assign tiers to connections for warm introductions.
                  </p>
                  <Button
                    onClick={handleConnectLinkedIn}
                    disabled={linkedinConnecting}
                    className="gap-2"
                  >
                    {linkedinConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Connect LinkedIn Account
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    <strong>Note:</strong> You'll be redirected to LinkedIn to authorize the connection. We'll only access your profile information and network connections to help you find leads.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
