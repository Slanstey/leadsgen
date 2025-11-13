import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lead, LeadStatus, Comment } from "@/types/lead";
import { LeadsTable } from "@/components/LeadsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart3, Settings, Search, Menu, Home, LogOut, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ExportDialog } from "@/components/ExportDialog";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [companySearch, setCompanySearch] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Fetch leads from database
  const fetchLeads = useCallback(async () => {
    const DEFAULT_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    
    // Don't fetch leads for default tenant users
    if (!profile?.tenant_id || profile.tenant_id === DEFAULT_TENANT_ID) {
      setLeads([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase environment variables are not configured. Please check your .env file.");
      }

      // Fetch leads (RLS will automatically filter by tenant_id)
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (leadsError) {
        console.error("Leads fetch error:", leadsError);
        throw new Error(`Failed to fetch leads: ${leadsError.message}`);
      }

      // Fetch comments for all leads
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .order("created_at", { ascending: true });

      if (commentsError) {
        console.error("Comments fetch error:", commentsError);
        throw new Error(`Failed to fetch comments: ${commentsError.message}`);
      }

      // Combine leads with their comments
      const leadsWithComments: Lead[] = (leadsData || []).map((lead) => {
        const leadComments: Comment[] = (commentsData || [])
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
      setError(null);
    } catch (error) {
      console.error("Error fetching leads:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load leads";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    const DEFAULT_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    // Only fetch leads if user has a tenant and it's not the default tenant
    if (profile?.tenant_id && profile.tenant_id !== DEFAULT_TENANT_ID) {
      fetchLeads();
    } else {
      setLeads([]);
      setLoading(false);
    }
  }, [profile?.tenant_id]); // Only depend on tenant_id, not fetchLeads

  // Refetch when navigating back to this page
  useEffect(() => {
    const DEFAULT_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    if (location.pathname === "/" && profile?.tenant_id && profile.tenant_id !== DEFAULT_TENANT_ID && !loading) {
      fetchLeads();
    } else if (profile?.tenant_id === DEFAULT_TENANT_ID) {
      setLeads([]);
      setLoading(false);
    }
  }, [location.pathname, profile?.tenant_id]); // Remove fetchLeads from dependencies

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
    if (!profile?.tenant_id) {
      toast.error("Unable to add comment: tenant not found");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          lead_id: leadId,
          text: commentText,
          author: profile.full_name || profile.email || "Current User",
          tenant_id: profile.tenant_id,
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

  const filteredLeads = useMemo(() => {
    try {
      if (!leads || leads.length === 0) {
        return [];
      }

      return leads.filter((lead) => {
        // Filter out ignored leads by default unless showIgnored is true
        if (lead.status === "ignored" && !showIgnored) {
          return false;
        }

        const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
        const matchesCompany = lead.companyName
          .toLowerCase()
          .includes(companySearch.toLowerCase());
        return matchesStatus && matchesCompany;
      });
    } catch (error) {
      console.error("Error filtering leads:", error);
      return leads || [];
    }
  }, [leads, statusFilter, companySearch, showIgnored]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">LeadFlow</h1>
                <p className="text-sm text-muted-foreground">Lead Generation Dashboard</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                {(profile as any)?.is_admin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate("/login", { replace: true });
                    toast.success("Successfully signed out");
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Active Leads</h2>
          <p className="text-muted-foreground">
            Track and manage your lead pipeline
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Leads</div>
            <div className="text-3xl font-bold mt-2">{filteredLeads.length}</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">Qualified</div>
            <div className="text-3xl font-bold mt-2 text-success">
              {filteredLeads.filter((l) => l.status === "qualified").length}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">In Progress</div>
            <div className="text-3xl font-bold mt-2 text-info">
              {filteredLeads.filter((l) => l.status === "in_progress").length}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm font-medium text-muted-foreground">Closed Won</div>
            <div className="text-3xl font-bold mt-2 text-accent">
              {filteredLeads.filter((l) => l.status === "closed_won").length}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as LeadStatus | "all")}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_contacted">Not Contacted</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="closed_won">Closed Won</SelectItem>
              <SelectItem value="closed_lost">Closed Lost</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showIgnored"
              checked={showIgnored}
              onCheckedChange={(checked) => {
                setShowIgnored(checked === true);
              }}
            />
            <Label
              htmlFor="showIgnored"
              className="text-sm font-normal cursor-pointer"
            >
              Show ignored leads
            </Label>
          </div>
          <Button
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading leads...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
            <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Leads</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : profile?.tenant_id === 'ffffffff-ffff-ffff-ffff-ffffffffffff' ? (
          <div className="rounded-lg border bg-muted/50 p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">No Leads Available</h3>
            <p className="text-sm text-muted-foreground">
              You are currently assigned to the default tenant. Leads are only available for users assigned to specific tenant organizations. Please contact your administrator to be assigned to a tenant.
            </p>
          </div>
        ) : (
          <LeadsTable
            leads={filteredLeads}
            onStatusChange={handleStatusChange}
            onAddComment={handleAddComment}
          />
        )}

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          allLeads={leads}
          filteredLeads={filteredLeads}
        />
      </main>
    </div>
  );
};

export default Index;
