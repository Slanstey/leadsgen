import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { ArrowLeft, Loader2, User, Mail, Calendar, Building2, Eye, Download, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LeadsTable } from "@/components/LeadsTable";
import { ExportDialog } from "@/components/ExportDialog";
import { CsvUploadDialog } from "@/components/CsvUploadDialog";
import { Lead, LeadStatus, LeadTier } from "@/types/lead";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldVisibilityConfig, defaultFieldVisibility, LeadFieldKey } from "@/types/tenantPreferences";

interface TenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
    admin_notes: string | null;
  };
  preferences: {
    [key: string]: any;
  } | null;
  users: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    role: string | null;
    created_at: string;
  }>;
}

const AdminTenantDetail = () => {
  const navigate = useNavigate();
  const { tenantId } = useParams<{ tenantId: string }>();
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tenantDetail, setTenantDetail] = useState<TenantDetail | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showLeads, setShowLeads] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [formData, setFormData] = useState({
    targetIndustry: "",
    companySize: "",
    locations: "",
    targetPositions: "",
    revenueRange: "",
    keywords: "",
    notes: "",
    experienceOperator: "=",
    experienceYears: 0,
    companyType: "",
    technologyStack: "",
    fundingStage: "",
  });
  const [adminNotes, setAdminNotes] = useState("");
  const [fieldVisibility, setFieldVisibility] = useState<FieldVisibilityConfig>(defaultFieldVisibility);

  useEffect(() => {
    // Check if user is admin
    if (profile && !(profile as any).is_admin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/");
      return;
    }

    if (profile && (profile as any).is_admin && tenantId) {
      loadTenantDetail();
    }
  }, [profile, tenantId, navigate]);

  const loadTenantDetail = async () => {
    if (!session || !tenantId) {
      return;
    }

    setLoading(true);
    try {
      // Fetch tenant directly from Supabase
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId)
        .single();

      if (tenantError) {
        throw new Error(`Failed to fetch tenant: ${tenantError.message}`);
      }

      if (!tenantData) {
        throw new Error("Tenant not found");
      }

      // Fetch preferences
      const { data: prefsData } = await supabase
        .from("tenant_preferences")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Error fetching users:", usersError);
      }

      setTenantDetail({
        tenant: tenantData,
        preferences: prefsData || null,
        users: usersData || [],
      });

      // Load preferences into form
      if (prefsData) {
        setFormData({
          targetIndustry: prefsData.target_industry || "",
          companySize: prefsData.company_size || "",
          locations: prefsData.locations || "",
          targetPositions: prefsData.target_positions || "",
          revenueRange: prefsData.revenue_range || "",
          keywords: prefsData.keywords || "",
          notes: prefsData.notes || "",
          experienceOperator: prefsData.experience_operator || "=",
          experienceYears: prefsData.experience_years || 0,
          companyType: prefsData.company_type || "",
          technologyStack: prefsData.technology_stack || "",
          fundingStage: prefsData.funding_stage || "",
        });

        const existingVisibility = (prefsData as any).field_visibility as
          | Partial<FieldVisibilityConfig>
          | null;
        if (existingVisibility && typeof existingVisibility === "object") {
          setFieldVisibility({
            ...defaultFieldVisibility,
            ...existingVisibility,
          });
        } else {
          setFieldVisibility(defaultFieldVisibility);
        }
      } else {
        setFieldVisibility(defaultFieldVisibility);
      }

      // Load admin notes
      setAdminNotes(tenantData.admin_notes || "");
    } catch (error: any) {
      console.error("Error loading tenant detail:", error);
      toast.error(error.message || "Failed to load tenant details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenantDetail) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Tenant not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const fetchLeads = async () => {
    if (!session || !tenantId) {
      toast.error("You must be logged in");
      return;
    }

    setLoadingLeads(true);
    try {
      // Fetch leads for this tenant
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (leadsError) {
        throw new Error(`Failed to fetch leads: ${leadsError.message}`);
      }

      // Fetch companies for all unique company names
      const uniqueCompanyNames = [...new Set((leadsData || []).map((lead: any) => lead.company_name))];
      const companiesMap = new Map<string, { industry?: string; location?: string; annualRevenue?: string; description?: string }>();
      
      if (uniqueCompanyNames.length > 0) {
        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("name, industry, location, annual_revenue, description")
          .in("name", uniqueCompanyNames)
          .eq("tenant_id", tenantId);

        if (!companiesError && companiesData) {
          companiesData.forEach((company: any) => {
            companiesMap.set(company.name, {
              industry: company.industry,
              location: company.location,
              annualRevenue: company.annual_revenue,
              description: company.description,
            });
          });
        }
      }

      // Fetch comments for this tenant's leads
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });

      if (commentsError) {
        console.error("Comments fetch error:", commentsError);
        // Don't throw, just log - leads can still be displayed without comments
      }

      // Combine leads with their comments and company data
      const leadsWithComments: Lead[] = (leadsData || []).map((lead: any) => {
        const leadComments = (commentsData || [])
          .filter((comment) => comment.lead_id === lead.id)
          .map((comment) => ({
            id: comment.id,
            text: comment.text,
            author: comment.author,
            createdAt: new Date(comment.created_at || ""),
          }));

        return {
          id: lead.id,
          companyName: lead.company_name,
          contactPerson: lead.contact_person,
          contactEmail: lead.contact_email,
          role: lead.role,
          status: lead.status as LeadStatus,
          tier: (lead.tier as LeadTier) || "medium",
          tierReason: lead.tier_reason,
          warmConnections: lead.warm_connections,
          comments: leadComments,
          createdAt: new Date(lead.created_at || ""),
          updatedAt: new Date(lead.updated_at || ""),
          company: companiesMap.get(lead.company_name) || undefined,
        };
      });

      setLeads(leadsWithComments);
      setShowLeads(true);
    } catch (error: any) {
      console.error("Error loading leads:", error);
      toast.error(error.message || "Failed to load leads");
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus as any, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;

      // Update local state
      setLeads((prevLeads) =>
        prevLeads.map((lead) =>
          lead.id === leadId
            ? { ...lead, status: newStatus, updatedAt: new Date() }
            : lead
        )
      );

      toast.success("Status updated successfully");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleAddComment = async (leadId: string, commentText: string) => {
    if (!profile || !tenantId) {
      toast.error("Unable to add comment: tenant not found");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          lead_id: leadId,
          text: commentText,
          author: profile.full_name || profile.email || "Admin",
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setLeads((prevLeads) =>
        prevLeads.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                comments: [
                  ...lead.comments,
                  {
                    id: data.id,
                    text: data.text,
                    createdAt: new Date(data.created_at || ""),
                    author: data.author,
                  },
                ],
                updatedAt: new Date(),
              }
            : lead
        )
      );

      // Update lead's updated_at timestamp
      await supabase
        .from("leads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", leadId);

      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleSavePreferences = async () => {
    if (!tenantId) {
      toast.error("Tenant ID not found");
      return;
    }

    setSavingPreferences(true);
    try {
      // Prepare preferences data with consolidated fields
      const preferencesData = {
        tenant_id: tenantId,
        // General preferences
        target_industry: formData.targetIndustry || null,
        company_size: formData.companySize || null,
        locations: formData.locations || null,
        target_positions: formData.targetPositions || null,
        revenue_range: formData.revenueRange || null,
        keywords: formData.keywords || null,
        notes: formData.notes || null,
        experience_operator: formData.experienceOperator || "=",
        experience_years: Number(formData.experienceYears) || 0,
        company_type: formData.companyType || null,
        technology_stack: formData.technologyStack || null,
        funding_stage: formData.fundingStage || null,
        updated_at: new Date().toISOString(),
      };

      // Check if preferences already exist
      const { data: existing, error: checkError } = await supabase
        .from("tenant_preferences")
        .select("id")
        .eq("tenant_id", tenantId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is fine
        throw checkError;
      }

      let result;
      if (existing) {
        // Update existing preferences
        const { data, error } = await supabase
          .from("tenant_preferences")
          .update(preferencesData)
          .eq("tenant_id", tenantId)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Insert new preferences
        const { data, error } = await supabase
          .from("tenant_preferences")
          .insert(preferencesData)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }

      if (result) {
        // Update local state
        setTenantDetail(prev => prev ? {
          ...prev,
          preferences: result
        } : null);
        toast.success("Preferences saved successfully");
      } else {
        toast.error("Failed to save preferences");
      }
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      const errorMessage = error?.message || error?.error || "Failed to save preferences";
      toast.error(errorMessage);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleSaveAdminNotes = async () => {
    if (!tenantId) {
      toast.error("Tenant ID not found");
      return;
    }

    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          admin_notes: adminNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (error) {
        throw error;
      }

      // Update local state
      setTenantDetail(prev => prev ? {
        ...prev,
        tenant: {
          ...prev.tenant,
          admin_notes: adminNotes.trim() || null,
        }
      } : null);

      toast.success("Admin notes saved successfully");
    } catch (error: any) {
      console.error("Error saving admin notes:", error);
      toast.error(error.message || "Failed to save admin notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleFieldVisibilityChange = async (field: LeadFieldKey, checked: boolean) => {
    if (!tenantId) {
      toast.error("Tenant ID not found");
      return;
    }

    const newVisibility: FieldVisibilityConfig = {
      ...fieldVisibility,
      [field]: checked,
    };

    // Optimistic update
    setFieldVisibility(newVisibility);

    try {
      // Check if preferences already exist
      const { data: existing, error: checkError } = await supabase
        .from("tenant_preferences")
        .select("id, field_visibility")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      const updateData = {
        field_visibility: newVisibility,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from("tenant_preferences")
          .update(updateData)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_preferences")
          .insert({
            tenant_id: tenantId,
            ...updateData,
          });

        if (error) throw error;
      }

      // Keep local tenantDetail in sync
      setTenantDetail((prev) =>
        prev
          ? {
              ...prev,
              preferences: {
                ...(prev.preferences || {}),
                field_visibility: newVisibility,
              },
            }
          : prev
      );
    } catch (error: any) {
      console.error("Error updating field visibility:", error);
      toast.error(error.message || "Failed to update field visibility");
      // Revert on error
      setFieldVisibility(fieldVisibility);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tenantDetail.tenant.name}</h1>
            <p className="text-muted-foreground">Tenant Details</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Tenant Information */}
          <Card>
            <CardHeader>
              <CardTitle>Tenant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-lg">{tenantDetail.tenant.name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slug</p>
                <p className="text-lg font-mono">{tenantDetail.tenant.slug}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-lg">{formatDate(tenantDetail.tenant.created_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Notes</CardTitle>
              <CardDescription>Additional notes for lead generation context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="E.g., Focus on companies that use cloud infrastructure, prefer B2B SaaS companies, avoid healthcare companies..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                These notes will be used to provide additional context when generating leads using AI/LLM methods.
              </p>
              <Button
                onClick={handleSaveAdminNotes}
                disabled={savingNotes}
                size="sm"
                variant="outline"
              >
                {savingNotes ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Notes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Generation Preferences</CardTitle>
              <CardDescription>Define ideal lead criteria to help target the right prospects</CardDescription>
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
                  <Label htmlFor="locations">Locations</Label>
                  <Input
                    id="locations"
                    placeholder="e.g., New York, San Francisco, London, North America, APAC"
                    value={formData.locations}
                    onChange={(e) =>
                      setFormData({ ...formData, locations: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of locations or regions
                  </p>
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

                <div className="space-y-2">
                  <Label htmlFor="companyType">Company Type</Label>
                  <Select
                    value={formData.companyType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, companyType: value })
                    }
                  >
                    <SelectTrigger id="companyType">
                      <SelectValue placeholder="Select company type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2B">B2B</SelectItem>
                      <SelectItem value="B2C">B2C</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                      <SelectItem value="SMB">SMB</SelectItem>
                      <SelectItem value="Startup">Startup</SelectItem>
                      <SelectItem value="Non-profit">Non-profit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fundingStage">Funding Stage</Label>
                  <Select
                    value={formData.fundingStage}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fundingStage: value })
                    }
                  >
                    <SelectTrigger id="fundingStage">
                      <SelectValue placeholder="Select funding stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bootstrapped">Bootstrapped</SelectItem>
                      <SelectItem value="Seed">Seed</SelectItem>
                      <SelectItem value="Series A">Series A</SelectItem>
                      <SelectItem value="Series B">Series B</SelectItem>
                      <SelectItem value="Series C+">Series C+</SelectItem>
                      <SelectItem value="Public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetPositions">Target Positions/Roles</Label>
                <Input
                  id="targetPositions"
                  placeholder="e.g., CEO, CTO, VP Engineering, COO, VP Operations"
                  value={formData.targetPositions}
                  onChange={(e) =>
                    setFormData({ ...formData, targetPositions: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of target positions or roles
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="experienceOperator">Experience Operator</Label>
                  <Select
                    value={formData.experienceOperator}
                    onValueChange={(value) =>
                      setFormData({ ...formData, experienceOperator: value })
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
                    value={formData.experienceYears}
                    onChange={(e) =>
                      setFormData({ 
                        ...formData, 
                        experienceYears: parseInt(e.target.value) || 0 
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of years (0-30)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technologyStack">Technology Stack</Label>
                <Input
                  id="technologyStack"
                  placeholder="e.g., Python, React, AWS, Docker, Kubernetes"
                  value={formData.technologyStack}
                  onChange={(e) =>
                    setFormData({ ...formData, technologyStack: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Preferred technologies or tools (comma-separated)
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
                <Button onClick={handleSavePreferences} className="gap-2" disabled={savingPreferences}>
                  {savingPreferences ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lead Field Visibility */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Field Visibility</CardTitle>
              <CardDescription>
                Control which columns are visible on the leads dashboard and in this tenant&apos;s lead table.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-company"
                    checked={fieldVisibility.company}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("company", checked === true)
                    }
                  />
                  <Label htmlFor="field-company">Company</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-details"
                    checked={fieldVisibility.details}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("details", checked === true)
                    }
                  />
                  <Label htmlFor="field-details">Company details (industry, location, description)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-contact-person"
                    checked={fieldVisibility.contactPerson}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("contactPerson", checked === true)
                    }
                  />
                  <Label htmlFor="field-contact-person">Contact person</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-contact-email"
                    checked={fieldVisibility.contactEmail}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("contactEmail", checked === true)
                    }
                  />
                  <Label htmlFor="field-contact-email">Email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-role"
                    checked={fieldVisibility.role}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("role", checked === true)
                    }
                  />
                  <Label htmlFor="field-role">Role</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-tier"
                    checked={fieldVisibility.tier}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("tier", checked === true)
                    }
                  />
                  <Label htmlFor="field-tier">Tier</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-status"
                    checked={fieldVisibility.status}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("status", checked === true)
                    }
                  />
                  <Label htmlFor="field-status">Status</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-warm-connections"
                    checked={fieldVisibility.warmConnections}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("warmConnections", checked === true)
                    }
                  />
                  <Label htmlFor="field-warm-connections">Warm connections</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="field-actions"
                    checked={fieldVisibility.actions}
                    onCheckedChange={(checked) =>
                      handleFieldVisibilityChange("actions", checked === true)
                    }
                  />
                  <Label htmlFor="field-actions">Actions (email, feedback, comments)</Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Changes are saved automatically and affect this tenant&apos;s views only.
              </p>
            </CardContent>
          </Card>

          {/* Users */}
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>{tenantDetail.users.length} {tenantDetail.users.length === 1 ? 'user' : 'users'} in this tenant</CardDescription>
            </CardHeader>
            <CardContent>
              {tenantDetail.users.length === 0 ? (
                <p className="text-muted-foreground">No users found</p>
              ) : (
                <div className="space-y-4">
                  {tenantDetail.users.map((user) => (
                    <div key={user.id} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{user.full_name || 'No name'}</p>
                            {user.role && (
                              <span className="text-xs px-2 py-1 bg-muted rounded">{user.role}</span>
                            )}
                          </div>
                          {user.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            Joined {formatDate(user.created_at)}
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Leads</CardTitle>
                  <CardDescription>View and manage leads for this tenant</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCsvUploadOpen(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </Button>
                  {showLeads && (
                    <Button
                      variant="outline"
                      onClick={() => setExportDialogOpen(true)}
                      disabled={leads.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                  <Button
                    onClick={fetchLeads}
                    disabled={loadingLeads}
                    variant={showLeads ? "outline" : "default"}
                  >
                    {loadingLeads ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        {showLeads ? "Refresh Leads" : "View Leads"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!showLeads ? (
                <p className="text-muted-foreground text-center py-4">
                  Click "View Leads" to load leads for this tenant
                </p>
              ) : loadingLeads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : leads.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No leads found for this tenant
                </p>
              ) : (
                <LeadsTable
                  leads={leads}
                  onStatusChange={handleStatusChange}
                  onAddComment={handleAddComment}
                  fieldVisibility={fieldVisibility}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          allLeads={leads}
          filteredLeads={leads}
        />

        <CsvUploadDialog
          open={csvUploadOpen}
          onOpenChange={setCsvUploadOpen}
          tenantId={tenantId || ""}
          onSuccess={() => {
            // Refresh leads if they're already shown
            if (showLeads) {
              fetchLeads();
            }
          }}
        />
      </div>
    </div>
  );
};

export default AdminTenantDetail;

