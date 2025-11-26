import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Sparkles, Users, Building2, Plus, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CsvUploadDialog } from "@/components/CsvUploadDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  user_count: number;
  lead_count: number;
  lead_generation_method: string[] | null;
  admin_notes: string | null;
}

type GeneratedLeadStatus =
  | "not_contacted"
  | "contacted"
  | "qualified"
  | "in_progress"
  | "closed_won"
  | "closed_lost";

type GeneratedLeadTier = "good" | "medium" | "bad";

interface GeneratedLeadPreview {
  company_name: string;
  contact_person: string;
  contact_email: string;
  role: string;
  status: GeneratedLeadStatus;
  tier: GeneratedLeadTier;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [generatingLeads, setGeneratingLeads] = useState<Set<string>>(new Set());
  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");
  const [newTenantDomain, setNewTenantDomain] = useState("");
  const [csvUploadOpen, setCsvUploadOpen] = useState<string | null>(null);
  const [previewTenantId, setPreviewTenantId] = useState<string | null>(null);
  const [generatedLeadsPreview, setGeneratedLeadsPreview] = useState<GeneratedLeadPreview[]>([]);
  const [releasingGeneratedLeads, setReleasingGeneratedLeads] = useState(false);
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
      // Default tenant ID that should be hidden from dashboard
      const DEFAULT_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      
      // Fetch tenants directly from Supabase (RLS policy allows admins to read all)
      // Exclude the default tenant from the dashboard
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("*")
        .neq("id", DEFAULT_TENANT_ID)
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
            admin_notes: tenant.admin_notes || null,
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
        // Backend should respect this flag: generate leads but DO NOT insert yet.
        // Instead, return them in `leads` so the admin can review & release.
        preview_only: true,
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
      console.log("[AdminDashboard] Generate leads response:", data);
      
      if (data.success) {
        // Try to extract leads from various possible response formats
        let leadsArray: any[] = [];
        
        if (Array.isArray(data.leads)) {
          leadsArray = data.leads;
        } else if (Array.isArray(data.generated_leads)) {
          leadsArray = data.generated_leads;
        } else if (Array.isArray(data.result)) {
          leadsArray = data.result;
        } else if (data.leads && typeof data.leads === 'object' && !Array.isArray(data.leads)) {
          // If leads is an object, try to extract an array from it
          if (Array.isArray(data.leads.items)) {
            leadsArray = data.leads.items;
          } else if (Array.isArray(data.leads.data)) {
            leadsArray = data.leads.data;
          }
        }

        // Process leads if we found any
        if (leadsArray.length > 0) {
          console.log("[AdminDashboard] Processing leads for preview:", leadsArray.length);
          const leads: GeneratedLeadPreview[] = leadsArray.map((lead: any) => ({
            company_name: lead.company_name || lead.companyName || lead.company || "",
            contact_person: lead.contact_person || lead.contactPerson || lead.contact || "",
            contact_email: lead.contact_email || lead.contactEmail || lead.email || "",
            role: lead.role || lead.title || lead.position || "",
            status: (lead.status as GeneratedLeadStatus) || "not_contacted",
            tier: (lead.tier as GeneratedLeadTier) || "medium",
          }));

          console.log("[AdminDashboard] Opening preview dialog with", leads.length, "leads");
          setPreviewTenantId(tenantId);
          setGeneratedLeadsPreview(leads);
          toast.success(`Generated ${leads.length} lead${leads.length === 1 ? "" : "s"} for review. Remove any you don't want, then click Release Leads.`);
        } else if (typeof data.leads_created === "number") {
          // Backwards-compatible fallback: backend already inserted leads
          // This should NOT happen if preview_only=true, but handle it gracefully
          console.warn("[AdminDashboard] Backend inserted leads directly instead of returning for preview. Backend should respect preview_only=true flag.");
          toast.warning(
            `Backend inserted ${data.leads_created} lead${data.leads_created === 1 ? "" : "s"} directly to the database. ` +
            `To enable preview mode, update the backend to return a 'leads' array instead of inserting when preview_only=true.`
          );
          // Reload tenants to update lead count
          loadTenants();
        } else {
          // If backend doesn't return leads array, show error with helpful message
          console.error("[AdminDashboard] Backend response missing 'leads' array:", data);
          toast.error(
            "Backend did not return leads for preview. The backend must return a 'leads' array in the response when preview_only=true. " +
            "Please update the backend to return generated leads without inserting them. Response received: " + JSON.stringify(data).substring(0, 200)
          );
        }
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

  const handleRemoveGeneratedPreviewLead = (index: number) => {
    setGeneratedLeadsPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReleaseGeneratedLeads = async () => {
    if (!session) {
      toast.error("You must be logged in");
      return;
    }

    if (!previewTenantId) {
      toast.error("No tenant selected for releasing leads");
      return;
    }

    if (generatedLeadsPreview.length === 0) {
      toast.error("No leads to release. Remove this dialog or generate again.");
      return;
    }

    setReleasingGeneratedLeads(true);
    try {
      const payload = {
        tenant_id: previewTenantId,
        leads: generatedLeadsPreview,
      };

      const response = await fetch(`${backendUrl}/api/admin/release-leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || "Unknown error" };
        }
        throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to release leads");
      }

      toast.success(`Released ${generatedLeadsPreview.length} lead${generatedLeadsPreview.length === 1 ? "" : "s"} to the database`);

      // Clear preview and refresh counts
      setPreviewTenantId(null);
      setGeneratedLeadsPreview([]);
      await loadTenants();
    } catch (error: any) {
      console.error("Error releasing generated leads:", error);
      toast.error(error.message || "Failed to release leads");
    } finally {
      setReleasingGeneratedLeads(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenantName.trim() || !newTenantSlug.trim()) {
      toast.error("Please fill in tenant name and slug");
      return;
    }

    // Validate slug format (lowercase, alphanumeric and hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(newTenantSlug)) {
      toast.error("Slug must be lowercase and contain only letters, numbers, and hyphens");
      return;
    }

    // Validate domain format if provided
    if (newTenantDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(newTenantDomain)) {
      toast.error("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setCreatingTenant(true);
    try {
      const tenantData: any = {
        name: newTenantName.trim(),
        slug: newTenantSlug.trim().toLowerCase(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add domain if provided
      if (newTenantDomain.trim()) {
        tenantData.domain = newTenantDomain.trim().toLowerCase();
      }

      const { data, error } = await supabase
        .from("tenants")
        .insert(tenantData)
        .select()
        .single();

      if (error) {
        // Check if it's a unique constraint violation
        if (error.code === '23505') {
          toast.error("A tenant with this name or slug already exists");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Tenant created successfully!");
      setCreateTenantOpen(false);
      setNewTenantName("");
      setNewTenantSlug("");
      setNewTenantDomain("");
      // Reload tenants to show the new one
      loadTenants();
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      toast.error(error.message || "Failed to create tenant");
    } finally {
      setCreatingTenant(false);
    }
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setNewTenantName(name);
    // Auto-generate slug if slug is empty or matches the previous name-based slug
    if (!newTenantSlug || newTenantSlug === newTenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) {
      const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setNewTenantSlug(autoSlug);
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
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
          <Button onClick={() => setCreateTenantOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
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

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCsvUploadOpen(tenant.id);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload CSV Leads
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* CSV Upload Dialog */}
        {csvUploadOpen && (
          <CsvUploadDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setCsvUploadOpen(null);
              }
            }}
            tenantId={csvUploadOpen}
            onSuccess={() => {
              // Reload tenants to update lead count
              loadTenants();
            }}
          />
        )}

        {/* Generated Leads Preview Dialog */}
        <Dialog
          open={!!previewTenantId}
          onOpenChange={(open) => {
            if (!open && !releasingGeneratedLeads) {
              setPreviewTenantId(null);
              setGeneratedLeadsPreview([]);
            }
          }}
        >
          <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Review Generated Leads</DialogTitle>
              <DialogDescription>
                Preview the leads generated by the services. Remove any you don&apos;t want, then release them to save in the database.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3">
              {generatedLeadsPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No leads are currently staged for this tenant. Generate leads again to populate this view.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="border rounded-md overflow-auto" style={{ maxHeight: '600px' }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead className="w-[60px] text-right">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generatedLeadsPreview.map((lead, index) => (
                          <TableRow key={`${lead.company_name}-${lead.contact_person}-${index}`}>
                            <TableCell>{lead.company_name}</TableCell>
                            <TableCell>{lead.contact_person}</TableCell>
                            <TableCell>{lead.contact_email}</TableCell>
                            <TableCell>{lead.role}</TableCell>
                            <TableCell className="capitalize text-xs">
                              {lead.status.replace("_", " ")}
                            </TableCell>
                            <TableCell className="capitalize text-xs">
                              {lead.tier}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveGeneratedPreviewLead(index)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leads will only be written to the database after you click <span className="font-semibold">Release Leads</span>.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!releasingGeneratedLeads) {
                    setPreviewTenantId(null);
                    setGeneratedLeadsPreview([]);
                  }
                }}
                disabled={releasingGeneratedLeads}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReleaseGeneratedLeads}
                disabled={
                  releasingGeneratedLeads ||
                  generatedLeadsPreview.length === 0 ||
                  !previewTenantId
                }
              >
                {releasingGeneratedLeads ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Releasing...
                  </>
                ) : (
                  "Release Leads"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createTenantOpen} onOpenChange={setCreateTenantOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Add a new tenant to the system. Users with matching email domains will be automatically assigned to this tenant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Tenant Name *</Label>
                <Input
                  id="tenant-name"
                  placeholder="Acme Corporation"
                  value={newTenantName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  disabled={creatingTenant}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-slug">Slug *</Label>
                <Input
                  id="tenant-slug"
                  placeholder="acme-corporation"
                  value={newTenantSlug}
                  onChange={(e) => setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={creatingTenant}
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (lowercase, letters, numbers, and hyphens only)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-domain">Email Domain (Optional)</Label>
                <Input
                  id="tenant-domain"
                  placeholder="acme.com"
                  value={newTenantDomain}
                  onChange={(e) => setNewTenantDomain(e.target.value)}
                  disabled={creatingTenant}
                />
                <p className="text-xs text-muted-foreground">
                  Users signing up with emails from this domain will be automatically assigned to this tenant
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateTenantOpen(false);
                  setNewTenantName("");
                  setNewTenantSlug("");
                  setNewTenantDomain("");
                }}
                disabled={creatingTenant}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateTenant} disabled={creatingTenant}>
                {creatingTenant ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Tenant"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;

