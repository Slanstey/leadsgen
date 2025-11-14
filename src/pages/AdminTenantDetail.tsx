import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, User, Mail, Calendar, Building2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LeadsTable } from "@/components/LeadsTable";
import { ExportDialog } from "@/components/ExportDialog";
import { Lead, LeadStatus } from "@/types/lead";

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

      // Combine leads with their comments
      const leadsWithComments: Lead[] = (leadsData || []).map((lead) => {
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
          tier: lead.tier || 1,
          comments: leadComments,
          createdAt: new Date(lead.created_at || ""),
          updatedAt: new Date(lead.updated_at || ""),
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

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Lead generation preferences and settings</CardDescription>
            </CardHeader>
            <CardContent>
              {tenantDetail.preferences ? (
                <div className="space-y-4">
                  {Object.entries(tenantDetail.preferences).map(([key, value]) => {
                    // Skip internal fields
                    if (['id', 'tenant_id', 'created_at', 'updated_at'].includes(key)) {
                      return null;
                    }
                    
                    // Skip null/empty values
                    if (value === null || value === '') {
                      return null;
                    }

                    // Format key for display
                    const displayKey = key
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, l => l.toUpperCase());

                    return (
                      <div key={key}>
                        <p className="text-sm font-medium text-muted-foreground">{displayKey}</p>
                        <p className="text-lg">{String(value)}</p>
                        <Separator className="mt-2" />
                      </div>
                    );
                  })}
                  {Object.entries(tenantDetail.preferences).filter(([key, value]) => 
                    !['id', 'tenant_id', 'created_at', 'updated_at'].includes(key) && value !== null && value !== ''
                  ).length === 0 && (
                    <p className="text-muted-foreground">No preferences configured</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No preferences configured</p>
              )}
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
      </div>
    </div>
  );
};

export default AdminTenantDetail;

