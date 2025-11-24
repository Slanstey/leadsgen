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
        console.log('[LinkedIn Profile] Loading profile for user:', profile.id);
        const { data: userProfile, error: profileError } = await supabase
          .from("user_profiles")
          .select("linkedin_profile_id, linkedin_profile_url, linkedin_first_name, linkedin_last_name, linkedin_headline, linkedin_connected_at")
          .eq("id", profile.id)
          .single();

        if (profileError) {
          console.error('[LinkedIn Profile] Error fetching profile:', profileError);
        } else {
          console.log('[LinkedIn Profile] Profile loaded:', {
            hasLinkedInId: !!userProfile?.linkedin_profile_id,
            linkedinProfileId: userProfile?.linkedin_profile_id,
          });
        }

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
            console.log('[LinkedIn Profile] Profile set successfully');
          } else {
            console.log('[LinkedIn Profile] No LinkedIn profile ID found');
          }
        }
      } catch (error) {
        console.error("[LinkedIn Profile] Error loading LinkedIn profile:", error);
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
      const redirectUri = `${window.location.origin}/settings`;
      
      console.log('[LinkedIn Connect] Starting connection flow', {
        backendUrl,
        redirectUri,
        userId: profile.id,
        origin: window.location.origin,
      });
      
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
          redirect_uri: redirectUri,
        }),
      });
      
      console.log('[LinkedIn Connect] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LinkedIn Connect] Error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[LinkedIn Connect] Success, received auth_url:', data.auth_url ? 'Yes' : 'No', {
        hasAuthUrl: !!data.auth_url,
        hasState: !!data.state,
      });
      
      if (data.auth_url) {
        // Redirect to LinkedIn OAuth
        console.log('[LinkedIn Connect] Redirecting to LinkedIn:', data.auth_url);
        window.location.href = data.auth_url;
      } else {
        console.error('[LinkedIn Connect] No auth_url in response:', data);
        toast.error("Failed to initiate LinkedIn connection");
        setLinkedinConnecting(false);
      }
    } catch (error) {
      console.error("[LinkedIn Connect] Error connecting LinkedIn:", error);
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
      {/* Refined header matching dashboard */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-soft">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2 h-9"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Manage your account connections</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* LinkedIn Connection Section */}
        <Card className="border-border/50 shadow-soft-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-bold tracking-tight">LinkedIn Account Connection</CardTitle>
            <CardDescription className="text-base mt-2">
              Connect your LinkedIn account to access your network, view potential leads, and manage warm introductions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {linkedinProfile?.profile_id ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-6 border border-border/50 rounded-xl bg-muted/30 shadow-soft">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-semibold text-lg shadow-soft">
                        {(linkedinProfile.first_name?.[0] || "") + (linkedinProfile.last_name?.[0] || "")}
                      </div>
                      <div>
                        <p className="font-semibold text-base">
                          {linkedinProfile.first_name} {linkedinProfile.last_name}
                        </p>
                        {linkedinProfile.headline && (
                          <p className="text-sm text-muted-foreground mt-0.5">{linkedinProfile.headline}</p>
                        )}
                      </div>
                    </div>
                    {linkedinProfile.profile_url && (
                      <a
                        href={linkedinProfile.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:text-primary/80 hover:underline inline-flex items-center gap-1.5 transition-colors"
                      >
                        View LinkedIn Profile
                        <Link2 className="h-3.5 w-3.5" />
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
                    className="gap-2 h-10 shrink-0"
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
                <div className="p-4 bg-success/10 rounded-xl border border-success/30">
                  <p className="text-sm text-foreground">
                    <strong className="font-semibold text-success">Connected!</strong> Your LinkedIn account is connected. You can now use your network to find leads and manage warm introductions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-8 lg:p-12 border-2 border-dashed border-border/50 rounded-xl text-center bg-muted/20">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-muted mb-4">
                    <Link2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Connect Your LinkedIn Account</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    Connect your LinkedIn account to access your professional network, view potential leads in your network, and assign tiers to connections for warm introductions.
                  </p>
                  <Button
                    onClick={handleConnectLinkedIn}
                    disabled={linkedinConnecting}
                    className="gap-2 h-11 px-6"
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
                <div className="p-4 bg-warning/10 rounded-xl border border-warning/30">
                  <p className="text-sm text-foreground">
                    <strong className="font-semibold text-warning">Note:</strong> You'll be redirected to LinkedIn to authorize the connection. We'll only access your profile information and network connections to help you find leads.
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
