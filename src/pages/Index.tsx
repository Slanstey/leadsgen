import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lead, LeadStatus, Comment, LeadTier } from "@/types/lead";
import { LeadsTable } from "@/components/LeadsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart3, Settings, Search, Menu, Home, LogOut, Download, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ExportDialog } from "@/components/ExportDialog";
import { FieldVisibilityConfig, defaultFieldVisibility } from "@/types/tenantPreferences";
import { Tables } from "@/lib/supabaseUtils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [companySearch, setCompanySearch] = useState("");
  const [warmConnectionSearch, setWarmConnectionSearch] = useState("");
  const [showIgnored, setShowIgnored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [fieldVisibility, setFieldVisibility] = useState<FieldVisibilityConfig>(defaultFieldVisibility);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // Default 50 leads per page
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalFilteredLeads, setTotalFilteredLeads] = useState(0);
  
  // Status counts for stats cards (total counts, not filtered by pagination)
  const [statusCounts, setStatusCounts] = useState({
    qualified: 0,
    inProgress: 0,
    closedWon: 0,
    total: 0,
  });

  const fetchFieldVisibility = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from(Tables.TENANT_PREFERENCES)
        .select("field_visibility")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Field visibility fetch error:", error);
        return;
      }

      const existing = (data as any)?.field_visibility as Partial<FieldVisibilityConfig> | null;

      if (existing && typeof existing === "object") {
        setFieldVisibility({
          ...defaultFieldVisibility,
          ...existing,
        });
      } else {
        setFieldVisibility(defaultFieldVisibility);
      }
    } catch (err) {
      console.error("Error loading field visibility:", err);
      setFieldVisibility(defaultFieldVisibility);
    }
  }, [profile?.tenant_id]);

  // Fetch total count for pagination - matching AdminTenantDetail pattern
  const fetchTotalCount = useCallback(async () => {
    if (!profile?.tenant_id) return 0;

    try {
      let countQuery = supabase
        .from(Tables.LEADS)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id);

      // Apply status filter
      if (statusFilter === "ignored") {
        countQuery = countQuery.eq("status", "ignored");
      } else if (statusFilter !== "all") {
        countQuery = countQuery.eq("status", statusFilter);
        if (!showIgnored) {
          countQuery = countQuery.neq("status", "ignored");
        }
      } else if (!showIgnored) {
        countQuery = countQuery.neq("status", "ignored");
      }

      // Apply company search filter (if provided)
      if (companySearch.trim()) {
        countQuery = countQuery.ilike("company_name", `%${companySearch.trim()}%`);
      }

      // Apply warm connection search filter (if provided)
      if (warmConnectionSearch.trim()) {
        countQuery = countQuery.ilike("warm_connections", `%${warmConnectionSearch.trim()}%`);
      }

      const { count, error } = await countQuery;

      if (error) {
        console.error("Total count fetch error:", error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error("Error fetching total count:", error);
      return 0;
    }
  }, [profile?.tenant_id, statusFilter, companySearch, warmConnectionSearch, showIgnored]);

  // Fetch leads from database with pagination - matching AdminTenantDetail pattern
  const fetchLeads = useCallback(async () => {
    if (!profile?.id) {
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

      // Fetch total count first (matching AdminTenantDetail pattern)
      const total = await fetchTotalCount();
      setTotalFilteredLeads(total);

      // Calculate pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build query with filters - matching AdminTenantDetail pattern
      let leadsQuery = supabase
        .from(Tables.LEADS)
        .select("*", { count: "exact" })
        .eq("tenant_id", profile.tenant_id);

      // Apply status filter
      if (statusFilter === "ignored") {
        leadsQuery = leadsQuery.eq("status", "ignored");
      } else if (statusFilter !== "all") {
        leadsQuery = leadsQuery.eq("status", statusFilter);
        if (!showIgnored) {
          leadsQuery = leadsQuery.neq("status", "ignored");
        }
      } else if (!showIgnored) {
        leadsQuery = leadsQuery.neq("status", "ignored");
      }

      // Apply company search filter (if provided)
      if (companySearch.trim()) {
        leadsQuery = leadsQuery.ilike("company_name", `%${companySearch.trim()}%`);
      }

      // Apply warm connection search filter (if provided)
      if (warmConnectionSearch.trim()) {
        leadsQuery = leadsQuery.ilike("warm_connections", `%${warmConnectionSearch.trim()}%`);
      }

      // Apply pagination and ordering
      const { data: leadsData, error: leadsError } = await leadsQuery
        .order("created_at", { ascending: false })
        .range(from, to);

      if (leadsError) {
        console.error("Leads fetch error:", leadsError);
        throw new Error(`Failed to fetch leads: ${leadsError.message}`);
      }

      // Fetch companies for unique company names in current page
      const uniqueCompanyNames = [...new Set((leadsData || []).map((lead: any) => lead.company_name))];
      const companiesMap = new Map<string, { industry?: string; location?: string; annualRevenue?: string; description?: string }>();

      if (uniqueCompanyNames.length > 0) {
        const { data: companiesData, error: companiesError } = await supabase
          .from(Tables.COMPANIES)
          .select("name, industry, location, annual_revenue, description")
          .in("name", uniqueCompanyNames)
          .eq("tenant_id", profile.tenant_id);

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

      // Fetch comments only for leads on current page (more efficient)
      const leadIds = (leadsData || []).map((lead: any) => lead.id);
      let commentsData: any[] = [];
      
      if (leadIds.length > 0) {
        const { data: comments, error: commentsError } = await supabase
          .from(Tables.COMMENTS)
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .in("lead_id", leadIds)
          .order("created_at", { ascending: true });

        if (commentsError) {
          console.error("Comments fetch error:", commentsError);
          // Don't throw - leads can still be displayed without comments
        } else {
          commentsData = comments || [];
        }
      }

      // Combine leads with their comments and company data
      const leadsWithComments: Lead[] = (leadsData || []).map((lead: any) => {
        const leadComments: Comment[] = commentsData
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
          isConnectedToTenant: lead.is_connected_to_tenant,
          comments: leadComments,
          createdAt: new Date(lead.created_at || ""),
          updatedAt: new Date(lead.updated_at || ""),
          company: companiesMap.get(lead.company_name) || undefined,
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
  }, [profile?.tenant_id, profile?.id, currentPage, pageSize, statusFilter, companySearch, warmConnectionSearch, showIgnored, fetchTotalCount]);

  // Fetch total count (all leads) for stats
  const fetchAllLeadsCount = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      const { count, error } = await supabase
        .from(Tables.LEADS)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id);

      if (error) {
        console.error("Total count fetch error:", error);
        return;
      }

      setTotalLeads(count || 0);
    } catch (error) {
      console.error("Error fetching total count:", error);
    }
  }, [profile?.tenant_id]);

  // Fetch status counts for stats cards (total counts, not paginated)
  const fetchStatusCounts = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      // Build base query with filters (excluding pagination)
      let baseQuery = supabase
        .from(Tables.LEADS)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id);

      // Apply ignored filter - exclude ignored items unless showIgnored is true
      if (!showIgnored) {
        baseQuery = baseQuery.neq("status", "ignored");
      }

      // Apply company search filter (if provided)
      if (companySearch.trim()) {
        baseQuery = baseQuery.ilike("company_name", `%${companySearch.trim()}%`);
      }

      // Apply warm connection search filter (if provided)
      if (warmConnectionSearch.trim()) {
        baseQuery = baseQuery.ilike("warm_connections", `%${warmConnectionSearch.trim()}%`);
      }

      // Fetch total count
      const { count: totalCount, error: totalError } = await baseQuery;

      if (totalError) {
        console.error("Total count fetch error:", totalError);
        return;
      }

      // Fetch counts for each status
      const buildStatusQuery = (status: string) => {
        let query = supabase
          .from(Tables.LEADS)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("status", status);

        if (companySearch.trim()) {
          query = query.ilike("company_name", `%${companySearch.trim()}%`);
        }
        if (warmConnectionSearch.trim()) {
          query = query.ilike("warm_connections", `%${warmConnectionSearch.trim()}%`);
        }

        return query;
      };

      // Fetch counts for each status in parallel
      const [qualifiedResult, inProgressResult, closedWonResult] = await Promise.all([
        buildStatusQuery("qualified"),
        buildStatusQuery("in_progress"),
        buildStatusQuery("closed_won"),
      ]);

      const counts = {
        qualified: qualifiedResult.count || 0,
        inProgress: inProgressResult.count || 0,
        closedWon: closedWonResult.count || 0,
        total: totalCount || 0,
      };

      setStatusCounts(counts);
    } catch (error) {
      console.error("Error fetching status counts:", error);
    }
  }, [profile?.tenant_id, companySearch, warmConnectionSearch, showIgnored]);

  // Reset to page 1 when filters change and refetch status counts
  useEffect(() => {
    setCurrentPage(1);
    if (profile?.tenant_id) {
      fetchStatusCounts();
    }
  }, [statusFilter, companySearch, warmConnectionSearch, showIgnored, profile?.tenant_id, fetchStatusCounts]);

  useEffect(() => {
    // Fetch leads for user's tenant (all users have tenant_id now)
    if (profile?.tenant_id) {
      fetchFieldVisibility();
      fetchLeads();
      fetchAllLeadsCount();
      fetchStatusCounts();
    } else {
      setLeads([]);
      setLoading(false);
    }
  }, [profile?.tenant_id, fetchFieldVisibility, fetchLeads, fetchAllLeadsCount, fetchStatusCounts]);

  // Refetch when navigating back to this page
  useEffect(() => {
    const DEFAULT_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    if (location.pathname === "/" && profile?.tenant_id && profile.tenant_id !== DEFAULT_TENANT_ID && !loading) {
      fetchFieldVisibility();
      fetchLeads();
      fetchAllLeadsCount();
      fetchStatusCounts();
    } else if (profile?.tenant_id === DEFAULT_TENANT_ID) {
      setLeads([]);
      setLoading(false);
    }
  }, [location.pathname, profile?.tenant_id, fetchFieldVisibility, fetchLeads, fetchAllLeadsCount, fetchStatusCounts]);

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from(Tables.LEADS)
        .update({ status: newStatus as any, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;

      // If status changed to "ignored" and showIgnored is false, remove from view
      // Otherwise update local state
      if (newStatus === "ignored" && !showIgnored) {
        // Remove the lead from the list immediately
        setLeads((prevLeads) => prevLeads.filter((lead) => lead.id !== leadId));
        // Update total filtered count
        setTotalFilteredLeads((prev) => Math.max(0, prev - 1));
        // Refetch to update counts
        fetchStatusCounts();
      } else {
        // Update local state
        setLeads((prevLeads) =>
          prevLeads.map((lead) =>
            lead.id === leadId
              ? { ...lead, status: newStatus, updatedAt: new Date() }
              : lead
          )
        );
        // Update status counts
        fetchStatusCounts();
      }

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
        .from(Tables.COMMENTS)
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
        .from(Tables.LEADS)
        .update({ updated_at: new Date().toISOString() })
        .eq("id", leadId);

      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  // Filtering is now done server-side, so filteredLeads is just the current page
  const filteredLeads = useMemo(() => {
    return leads || [];
  }, [leads]);

  // Calculate pagination info
  const totalPages = Math.ceil(totalFilteredLeads / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalFilteredLeads);

  // Handle page changes
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top when page changes
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Refined header with subtle elevation */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-soft">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  LeadFlow
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Lead Generation Dashboard</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Page header with better typography and staggered animation */}
        <div className="mb-8 lg:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Active Leads
          </h2>
          <p className="text-muted-foreground text-base">
            Track and manage your lead pipeline with precision
          </p>
        </div>

        {/* Enhanced stats cards with better visual hierarchy and staggered animations */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8 lg:mb-12">
          <div className="group relative overflow-hidden rounded-xl bg-card p-6 shadow-soft border border-border/50 hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '0ms' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Total Leads</div>
            </div>
            <div className="text-3xl lg:text-4xl font-bold tracking-tight">{statusCounts.total}</div>
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-card p-6 shadow-soft border border-border/50 hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Qualified</div>
            </div>
            <div className="text-3xl lg:text-4xl font-bold tracking-tight text-success">
              {statusCounts.qualified}
            </div>
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-success/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-card p-6 shadow-soft border border-border/50 hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">In Progress</div>
            </div>
            <div className="text-3xl lg:text-4xl font-bold tracking-tight text-info">
              {statusCounts.inProgress}
            </div>
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-info/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-card p-6 shadow-soft border border-border/50 hover:shadow-soft-lg transition-all duration-200 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-muted-foreground">Closed Won</div>
            </div>
            <div className="text-3xl lg:text-4xl font-bold tracking-tight text-accent">
              {statusCounts.closedWon}
            </div>
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        </div>

        {/* Refined filters section */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-9 h-11 bg-background border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search warm connections..."
                value={warmConnectionSearch}
                onChange={(e) => setWarmConnectionSearch(e.target.value)}
                className="pl-9 h-11 bg-background border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as LeadStatus | "all")}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-11 border-border/50">
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
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              className="w-full sm:w-auto h-11 border-border/50 hover:bg-muted/50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="showIgnored"
              checked={showIgnored}
              onCheckedChange={(checked) => {
                setShowIgnored(checked === true);
              }}
              className="h-4 w-4"
            />
            <Label
              htmlFor="showIgnored"
              className="text-sm font-normal cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            >
              Show ignored leads
            </Label>
          </div>
        </div>

        {/* Pagination Controls - At the top before the table */}
        {!loading && !error && leads.length > 0 && totalFilteredLeads > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex} to {endIndex} of {totalFilteredLeads} leads
              </div>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1); // Reset to first page when changing page size
                }}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="200">200 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage - 1);
                      }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      href="#"
                    />
                  </PaginationItem>
                  
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(1);
                          }}
                          className="cursor-pointer"
                          href="#"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {currentPage > 4 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                    </>
                  )}
                  
                  {/* Page numbers around current page */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(pageNum);
                          }}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                          href="#"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(totalPages);
                          }}
                          className="cursor-pointer"
                          href="#"
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      href="#"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Loading leads...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
            <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Leads</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="h-10"
            >
              Retry
            </Button>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No Leads Available</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {profile?.tenant_id
                ? "You don't have any leads yet. Generate leads using the search tools above."
                : "You don't have any leads yet. Generate leads using the search tools above."}
            </p>
          </div>
        ) : (
          <>
            <LeadsTable
              leads={filteredLeads}
              onStatusChange={handleStatusChange}
              onAddComment={handleAddComment}
              fieldVisibility={fieldVisibility}
            />
          </>
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
