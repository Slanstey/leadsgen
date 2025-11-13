import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Sparkles, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  user_count: number;
  lead_count: number;
  lead_generation_method: string[] | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [generatingLeads, setGeneratingLeads] = useState<Set<string>>(new Set());
  const hasLoadedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    // Check if user is admin
    if (profile && !(profile as any).is_admin) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        toast.error("Access denied. Admin privileges required.");
        navigate("/");
      }
      return;
    }

    if (profile && (profile as any).is_admin && session && !hasLoadedRef.current) {
      console.log("Admin user detected, loading tenants...");
      hasLoadedRef.current = true;
      loadTenants();
    }
  }, [profile, session]);

  const loadTenants = async () => {
    if (!session) {
      toast.error("You must be logged in");
      return;
    }

    setLoading(true);
    try {
      // Fetch tenants directly from Supabase (RLS policy allows admins to read all)
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (tenantsError) {
        throw new Error(`Failed to fetch tenants: ${tenantsError.message}`);
      }

      if (!tenantsData || tenantsData.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      // Get counts and preferences for each tenant
      const tenantsWithCounts = await Promise.all(
        tenantsData.map(async (tenant) => {
          // Count users
          const { data: usersData, error: usersError } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("tenant_id", tenant.id);

          const user_count = usersError ? 0 : (usersData?.length || 0);

          // Count leads
          const { data: leadsData, error: leadsError } = await supabase
            .from("leads")
            .select("id")
            .eq("tenant_id", tenant.id);

          const lead_count = leadsError ? 0 : (leadsData?.length || 0);

          // Get lead generation methods (array) - use maybeSingle to avoid error if none exist
          const { data: prefsData, error: prefsError } = await supabase
            .from("tenant_preferences")
            .select("lead_generation_method")
            .eq("tenant_id", tenant.id)
            .maybeSingle();
          
          if (prefsError && prefsError.code !== 'PGRST116') {
            console.error(`Error fetching preferences for tenant ${tenant.id}:`, prefsError);
          }

          return {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            created_at: tenant.created_at,
            user_count: user_count,
            lead_count: lead_count,
            lead_generation_method: prefsData?.lead_generation_method || [],
          };
        })
      );

      setTenants(tenantsWithCounts);
    } catch (error: any) {
      console.error("Error loading tenants:", error);
      toast.error(error.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleMethodChange = async (tenantId: string, method: string, checked: boolean) => {
    if (!session) {
      toast.error("You must be logged in");
      return;
    }

    // Get current methods
    const tenant = tenants.find(t => t.id === tenantId);
    const currentMethods = tenant?.lead_generation_method || [];
    
    // Update methods array
    let newMethods: string[];
    if (checked) {
      // Add method if not already present
      newMethods = currentMethods.includes(method) 
        ? currentMethods 
        : [...currentMethods, method];
    } else {
      // Remove method
      newMethods = currentMethods.filter(m => m !== method);
    }

    // Update local state immediately (optimistic update)
    setTenants(prev => prev.map(t => 
      t.id === tenantId ? { ...t, lead_generation_method: newMethods } : t
    ));

    // Update database in background
    try {
      // Check if preferences exist (use maybeSingle to avoid error if none exist)
      const { data: existingPrefs, error: checkError } = await supabase
        .from("tenant_preferences")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine
        throw checkError;
      }

      if (existingPrefs) {
        // Update existing preferences
        const { error } = await supabase
          .from("tenant_preferences")
          .update({ 
            lead_generation_method: newMethods,
            updated_at: new Date().toISOString()
          })
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } else {
        // Create new preferences
        const { error } = await supabase
          .from("tenant_preferences")
          .insert({
            tenant_id: tenantId,
            lead_generation_method: newMethods,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error("Error creating preferences:", error);
          throw error;
        }
      }
    } catch (error: any) {
      console.error("Error updating method:", error);
      // Revert optimistic update on error
      setTenants(prev => prev.map(t => 
        t.id === tenantId ? { ...t, lead_generation_method: currentMethods } : t
      ));
      toast.error(error.message || "Failed to update lead generation method");
    }
  };

  const handleGenerateLeads = async (tenantId: string) => {
    if (!session) {
      toast.error("You must be logged in");
      return;
    }

    // Log the request details
    console.log("=== Generate Leads Request ===");
    console.log("Tenant ID:", tenantId);
    console.log("Tenant ID type:", typeof tenantId);
    
    // Get the methods from the tenant object to log them
    const tenant = tenants.find(t => t.id === tenantId);
    console.log("Lead generation methods from frontend state:", tenant?.lead_generation_method);
    console.log("=================================");

    setGeneratingLeads(prev => new Set(prev).add(tenantId));
    try {
      const requestBody = {
        tenant_id: tenantId,
      };
      console.log("Request body:", requestBody);
      
      const response = await fetch(`${backendUrl}/api/admin/generate-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
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
        toast.success(`Successfully generated ${data.leads_created} leads`);
        // Reload tenants to update lead count
        loadTenants();
      } else {
        throw new Error(data.error || "Failed to generate leads");
      }
    } catch (error: any) {
      console.error("Error generating leads:", error);
      toast.error(error.message || "Failed to generate leads");
    } finally {
      setGeneratingLeads(prev => {
        const next = new Set(prev);
        next.delete(tenantId);
        return next;
      });
    }
  };

  const leadGenerationMethods = [
    { value: "google_custom_search", label: "Google Custom Search Engine" },
    { value: "google_places_api", label: "Google Places API" },
    { value: "pure_llm", label: "Pure LLM" },
    { value: "agentic_workflow", label: "Agentic Workflow" },
    { value: "linkedin_search", label: "LinkedIn Search" },
    { value: "linkedin_sales_navigator", label: "LinkedIn Sales Navigator" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage tenants and generate leads</p>
          </div>
        </div>

        <div className="grid gap-6">
          {tenants.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No tenants found</p>
              </CardContent>
            </Card>
          ) : (
            tenants.map((tenant) => (
              <Card key={tenant.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{tenant.name}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {tenant.user_count} {tenant.user_count === 1 ? 'user' : 'users'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          {tenant.lead_count} {tenant.lead_count === 1 ? 'lead' : 'leads'}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Lead Generation Methods</Label>
                      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                        {leadGenerationMethods.map((method) => {
                          const isChecked = (tenant.lead_generation_method || []).includes(method.value);
                          return (
                            <div key={method.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${tenant.id}-${method.value}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  handleMethodChange(tenant.id, method.value, checked === true);
                                }}
                              />
                              <Label 
                                htmlFor={`${tenant.id}-${method.value}`} 
                                className="text-sm cursor-pointer"
                              >
                                {method.label}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateLeads(tenant.id);
                      }}
                      disabled={!tenant.lead_generation_method || tenant.lead_generation_method.length === 0 || generatingLeads.has(tenant.id)}
                      className="w-full"
                    >
                      {generatingLeads.has(tenant.id) ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Leads
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

