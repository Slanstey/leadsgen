import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [formData, setFormData] = useState({
    targetIndustry: "",
    companySize: "",
    geographicRegion: "",
    targetRoles: "",
    revenueRange: "",
    keywords: "",
    notes: "",
  });
  const [linkedinData, setLinkedinData] = useState({
    locations: "",
    positions: "",
    experienceOperator: "=",
    experienceYears: 0,
  });

  // Load tenant settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!profile?.tenant_id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", profile.tenant_id)
          .single();

        if (error) {
          console.error("Error loading settings:", error);
          toast.error("Failed to load settings");
          setLoading(false);
          return;
        }

        if (data) {
          // Load LinkedIn search settings
          setLinkedinData({
            locations: data.linkedin_locations || "",
            positions: data.linkedin_positions || "",
            experienceOperator: data.linkedin_experience_operator || "=",
            experienceYears: data.linkedin_experience_years || 0,
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.tenant_id) {
      toast.error("You must be logged in to save settings");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          linkedin_locations: linkedinData.locations,
          linkedin_positions: linkedinData.positions,
          linkedin_experience_operator: linkedinData.experienceOperator,
          linkedin_experience_years: linkedinData.experienceYears,
        })
        .eq("id", profile.tenant_id);

      if (error) {
        console.error("Error saving settings:", error);
        toast.error("Failed to save settings");
        return;
      }

      toast.success("LinkedIn search preferences saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSearchLinkedIn = async () => {
    console.log("🔍 LinkedIn search button clicked");
    
    if (!profile?.tenant_id) {
      console.error("❌ No tenant_id found in profile");
      toast.error("You must be logged in to search LinkedIn");
      return;
    }

    if (!linkedinData.locations || !linkedinData.positions) {
      console.error("❌ Missing locations or positions");
      toast.error("Please fill in locations and positions before searching");
      return;
    }

    console.log("✅ Pre-flight checks passed, starting search...");
    setSearching(true);
    
    try {
      // Get the session token for authentication
      console.log("📝 Step 1: Getting session token...");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("❌ No session found");
        toast.error("You must be logged in to search LinkedIn");
        setSearching(false);
        return;
      }
      console.log("✅ Session token obtained");

      // Call Python backend API
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      console.log(`🌐 Backend URL: ${backendUrl}`);
      
      // Parse and filter empty values
      console.log("📝 Step 2: Parsing locations and positions...");
      const locations = linkedinData.locations
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      
      const positions = linkedinData.positions
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      console.log(`✅ Parsed ${locations.length} location(s):`, locations);
      console.log(`✅ Parsed ${positions.length} position(s):`, positions);
      
      if (locations.length === 0 || positions.length === 0) {
        console.error("❌ Empty locations or positions after parsing");
        toast.error("Please fill in at least one location and one position");
        setSearching(false);
        return;
      }
      
      const requestBody = {
        locations: locations,
        positions: positions,
        experience_operator: linkedinData.experienceOperator,
        experience_years: Number(linkedinData.experienceYears) || 0,
        tenant_id: profile.tenant_id,
        limit: 10,
      };
      
      console.log("📝 Step 3: Preparing request body:", requestBody);
      console.log(`📡 Step 4: Sending POST request to ${backendUrl}/api/search-linkedin...`);
      
      const response = await fetch(`${backendUrl}/api/search-linkedin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`📥 Step 5: Received response with status: ${response.status}`);
      console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`❌ HTTP error! status: ${response.status}`);
        const errorText = await response.text();
        console.error(`❌ Error response body:`, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        
        throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      console.log("📝 Step 6: Parsing response JSON...");
      const data = await response.json();
      console.log("✅ Response data:", data);

      if (data.success) {
        console.log(`✅ Success! Found ${data.profiles_found} profiles, created ${data.leads_created} leads`);
        toast.success(`Successfully found ${data.profiles_found} profiles and created ${data.leads_created} leads`);
        // Refresh the page to show new leads
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } else {
        console.error(`❌ Search failed: ${data.error}`);
        toast.error(data.error || "Failed to search LinkedIn");
      }
    } catch (error) {
      console.error("❌ Error searching LinkedIn:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      toast.error(error instanceof Error ? error.message : "Failed to search LinkedIn");
    } finally {
      console.log("🏁 Search process completed, resetting searching state");
      setSearching(false);
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
              <p className="text-sm text-muted-foreground">Configure your lead generation preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lead Generation Preferences</CardTitle>
            <CardDescription>
              Define your ideal lead criteria to help target the right prospects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetIndustry">Target Industry</Label>
                <Input
                  id="targetIndustry"
                  placeholder="e.g., Mining, Energy, Manufacturing"
                  value={formData.targetIndustry}
                  onChange={(e) =>
                    setFormData({ ...formData, targetIndustry: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size</Label>
                <Select
                  value={formData.companySize}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companySize: value })
                  }
                >
                  <SelectTrigger id="companySize">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-50">1-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-1000">201-1000 employees</SelectItem>
                    <SelectItem value="1001-5000">1001-5000 employees</SelectItem>
                    <SelectItem value="5000+">5000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geographicRegion">Geographic Region</Label>
                <Input
                  id="geographicRegion"
                  placeholder="e.g., North America, APAC, Europe"
                  value={formData.geographicRegion}
                  onChange={(e) =>
                    setFormData({ ...formData, geographicRegion: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="revenueRange">Annual Revenue Range</Label>
                <Select
                  value={formData.revenueRange}
                  onValueChange={(value) =>
                    setFormData({ ...formData, revenueRange: value })
                  }
                >
                  <SelectTrigger id="revenueRange">
                    <SelectValue placeholder="Select revenue range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-10m">$0-10M</SelectItem>
                    <SelectItem value="10m-50m">$10M-50M</SelectItem>
                    <SelectItem value="50m-100m">$50M-100M</SelectItem>
                    <SelectItem value="100m-500m">$100M-500M</SelectItem>
                    <SelectItem value="500m-1b">$500M-1B</SelectItem>
                    <SelectItem value="1b+">$1B+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetRoles">Target Roles/Titles</Label>
              <Input
                id="targetRoles"
                placeholder="e.g., CEO, COO, VP Operations, Chief Mining Officer"
                value={formData.targetRoles}
                onChange={(e) =>
                  setFormData({ ...formData, targetRoles: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of target roles
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input
                id="keywords"
                placeholder="e.g., sustainability, expansion, digital transformation"
                value={formData.keywords}
                onChange={(e) =>
                  setFormData({ ...formData, keywords: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Keywords to help identify relevant leads
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional criteria or preferences..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="gap-2" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>LinkedIn Profile Search</CardTitle>
            <CardDescription>
              Configure LinkedIn search settings to generate leads automatically. Results are limited to 10 per search to stay within API limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="linkedinLocations">Locations (Comma Separated)</Label>
                <Input
                  id="linkedinLocations"
                  placeholder="e.g., New York, San Francisco, London"
                  value={linkedinData.locations}
                  onChange={(e) =>
                    setLinkedinData({ ...linkedinData, locations: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of locations to search
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedinPositions">Positions (Comma Separated)</Label>
                <Input
                  id="linkedinPositions"
                  placeholder="e.g., CEO, CTO, VP Engineering"
                  value={linkedinData.positions}
                  onChange={(e) =>
                    setLinkedinData({ ...linkedinData, positions: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of positions/titles to search
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experienceOperator">Experience Operator</Label>
                <Select
                  value={linkedinData.experienceOperator}
                  onValueChange={(value) =>
                    setLinkedinData({ ...linkedinData, experienceOperator: value })
                  }
                >
                  <SelectTrigger id="experienceOperator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Greater than</SelectItem>
                    <SelectItem value="<">Less than</SelectItem>
                    <SelectItem value="=">Equal to</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experienceYears">Years of Experience</Label>
                <Input
                  id="experienceYears"
                  type="number"
                  min="0"
                  max="30"
                  placeholder="0"
                  value={linkedinData.experienceYears}
                  onChange={(e) =>
                    setLinkedinData({ 
                      ...linkedinData, 
                      experienceYears: parseInt(e.target.value) || 0 
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Number of years (0-30)
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Click the button below to search LinkedIn and add up to 10 leads to your database.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSearchLinkedIn} 
                  disabled={searching || !linkedinData.locations || !linkedinData.positions}
                  className="gap-2"
                >
                  {searching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Search LinkedIn (10 results)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
