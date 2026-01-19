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

// Helper function to parse market cap string to numeric value (in millions)
const parseMarketCap = (marketCap: string | null | undefined): number | null => {
  if (!marketCap || marketCap === "Unknown" || marketCap === "null" || marketCap.toLowerCase() === "null") {
    return null;
  }

  // Extract number and unit (M or B)
  const match = marketCap.match(/USD\s*([\d.]+)\s*([MB])/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  // Convert to millions
  if (unit === "B") {
    return value * 1000;
  }
  return value;
};

// Helper function to check if market cap falls within a bracket
const marketCapInBracket = (marketCap: string | null | undefined, bracket: string): boolean => {
  if (bracket === "unknown") {
    return !marketCap || marketCap === "Unknown" || marketCap === "null" || marketCap.toLowerCase() === "null";
  }

  const value = parseMarketCap(marketCap);
  if (value === null) return false;

  switch (bracket) {
    case "under_100m":
      return value < 100;
    case "100m_500m":
      return value >= 100 && value < 500;
    case "500m_1b":
      return value >= 500 && value < 1000;
    case "1b_10b":
      return value >= 1000 && value < 10000;
    case "10b_50b":
      return value >= 10000 && value < 50000;
    case "over_50b":
      return value >= 50000;
    default:
      return false;
  }
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [companySearch, setCompanySearch] = useState("");
  const [warmConnectionSearch, setWarmConnectionSearch] = useState("");
  const [commoditySearch, setCommoditySearch] = useState("");
  const [tierFilter, setTierFilter] = useState<LeadTier | "all">("all");
  const [companySizeFilter, setCompanySizeFilter] = useState<string>("all");
  const [marketCapFilter, setMarketCapFilter] = useState<string>("all");
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

  // Sorting state
  type SortColumn = "companyName" | "contactPerson" | "contactEmail" | "role" | "tier" | "status" | "followsOnLinkedin" | "createdAt" | "marketCapitalisation" | "companySizeInterval" | null;
  type SortDirection = "asc" | "desc" | null;
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Status counts for stats cards (total counts, not filtered)
  const [statusCounts, setStatusCounts] = useState({
    contacted: 0,
    discussingScope: 0,
    proposalDelivered: 0,
    total: 0,
  });

  // Filtered status counts (with filters applied)
  const [filteredStatusCounts, setFilteredStatusCounts] = useState({
    contacted: 0,
    discussingScope: 0,
    proposalDelivered: 0,
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
        // Migrate old "details" field to individual fields
        const migratedVisibility: Partial<FieldVisibilityConfig> = { ...existing };
        if ("details" in migratedVisibility && !("industry" in migratedVisibility)) {
          const detailsValue = migratedVisibility.details as boolean | undefined;
          migratedVisibility.industry = detailsValue ?? true;
          migratedVisibility.location = detailsValue ?? true;
          migratedVisibility.description = detailsValue ?? true;
          delete (migratedVisibility as any).details;
        }

        // Migrate old "actions" field to individual action fields
        if ("actions" in migratedVisibility && !("actionEmail" in migratedVisibility)) {
          const actionsValue = migratedVisibility.actions as boolean | undefined;
          migratedVisibility.actionEmail = actionsValue ?? true;
          migratedVisibility.actionFeedback = actionsValue ?? true;
          migratedVisibility.actionComments = actionsValue ?? true;
          delete (migratedVisibility as any).actions;
        }

        setFieldVisibility({
          ...defaultFieldVisibility,
          ...migratedVisibility,
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
        countQuery = countQuery.ilike("company_name", `${companySearch.trim()}%`);
      }

      // Apply warm connection search filter (if provided)
      if (warmConnectionSearch.trim()) {
        countQuery = countQuery.ilike("warm_connections", `${warmConnectionSearch.trim()}%`);
      }

      // Apply commodity search filter (if provided)
      if (commoditySearch.trim()) {
        countQuery = countQuery.ilike("commodity_fields", `${commoditySearch.trim()}%`);
      }

      // Apply tier filter
      if (tierFilter !== "all") {
        countQuery = countQuery.eq("tier", tierFilter);
      }

      // Apply company size filter
      if (companySizeFilter !== "all") {
        countQuery = countQuery.eq("company_size_interval", companySizeFilter);
      }

      // Apply market cap filter
      if (marketCapFilter !== "all") {
        if (marketCapFilter === "unknown") {
          countQuery = countQuery.or("market_capitalisation.is.null,market_capitalisation.eq.Unknown,market_capitalisation.eq.null");
        } else {
          countQuery = countQuery.ilike("market_capitalisation", `%${marketCapFilter}%`);
        }
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
  }, [profile?.tenant_id, statusFilter, companySearch, warmConnectionSearch, commoditySearch, showIgnored, tierFilter, companySizeFilter, marketCapFilter]);

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
        leadsQuery = leadsQuery.ilike("company_name", `${companySearch.trim()}%`);
      }

      // Apply warm connection search filter (if provided)
      if (warmConnectionSearch.trim()) {
        leadsQuery = leadsQuery.ilike("warm_connections", `${warmConnectionSearch.trim()}%`);
      }

      // Apply commodity search filter (if provided)
      if (commoditySearch.trim()) {
        leadsQuery = leadsQuery.ilike("commodity_fields", `${commoditySearch.trim()}%`);
      }

      // Apply tier filter
      if (tierFilter !== "all") {
        leadsQuery = leadsQuery.eq("tier", tierFilter);
      }

      // Apply company size filter
      if (companySizeFilter !== "all") {
        leadsQuery = leadsQuery.eq("company_size_interval", companySizeFilter);
      }

      // Apply market cap filter
      if (marketCapFilter !== "all") {
        if (marketCapFilter === "unknown") {
          leadsQuery = leadsQuery.or("market_capitalisation.is.null,market_capitalisation.eq.Unknown,market_capitalisation.eq.null");
        }
        // For bracket-based filtering, we'll filter client-side after fetching
        // since Supabase doesn't easily support parsing string values for numeric comparison
      }

      // Apply sorting
      if (sortColumn && sortDirection !== null) {
        // Map frontend column names to database column names
        const columnMap: Record<string, string> = {
          companyName: "company_name",
          contactPerson: "contact_person",
          contactEmail: "contact_email",
          role: "role",
          tier: "tier",
          status: "status",
          followsOnLinkedin: "follows_on_linkedin",
          createdAt: "created_at",
          marketCapitalisation: "market_capitalisation",
          companySizeInterval: "company_size_interval",
        };

        const dbColumn = columnMap[sortColumn];
        if (dbColumn) {
          leadsQuery = leadsQuery.order(dbColumn, { ascending: sortDirection === "asc" });
        } else {
          // Default to created_at desc if column mapping fails
          leadsQuery = leadsQuery.order("created_at", { ascending: false });
        }
      } else {
        // Default ordering: newest first
        leadsQuery = leadsQuery.order("created_at", { ascending: false });
      }

      // Apply pagination
      const { data: leadsData, error: leadsError } = await leadsQuery
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
          tier: (lead.tier as LeadTier) || "2nd",
          tierReason: lead.tier_reason,
          warmConnections: lead.warm_connections,
          isConnectedToTenant: lead.is_connected_to_tenant,
          followsOnLinkedin: lead.follows_on_linkedin,
          marketCapitalisation: lead.market_capitalisation,
          companySizeInterval: lead.company_size_interval,
          commodityFields: lead.commodity_fields,
          comments: leadComments,
          createdAt: new Date(lead.created_at || ""),
          updatedAt: new Date(lead.updated_at || ""),
          company: companiesMap.get(lead.company_name) || undefined,
        };
      });

      // Apply market cap bracket filtering client-side (if needed)
      let filteredLeads = leadsWithComments;
      if (marketCapFilter !== "all" && marketCapFilter !== "unknown") {
        filteredLeads = leadsWithComments.filter((lead) => {
          return marketCapInBracket(lead.marketCapitalisation, marketCapFilter);
        });
      }

      setLeads(filteredLeads);
      setError(null);
    } catch (error) {
      console.error("Error fetching leads:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load leads";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, currentPage, pageSize, statusFilter, companySearch, warmConnectionSearch, commoditySearch, showIgnored, tierFilter, companySizeFilter, marketCapFilter, sortColumn, sortDirection, fetchTotalCount]);

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

  // Fetch unfiltered status counts for stats cards (no filters applied)
  const fetchUnfilteredStatusCounts = useCallback(async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch total count (unfiltered)
      const { count: totalCount, error: totalError } = await supabase
        .from(Tables.LEADS)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id);

      if (totalError) {
        console.error("Total count fetch error:", totalError);
        return;
      }

      // Fetch counts for each status (unfiltered) in parallel
      const [contactedResult, discussingScopeResult, proposalDeliveredResult] = await Promise.all([
        supabase
          .from(Tables.LEADS)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "contacted"),
        supabase
          .from(Tables.LEADS)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "discussing_scope"),
        supabase
          .from(Tables.LEADS)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "proposal_delivered"),
      ]);

      const counts = {
        contacted: contactedResult.count || 0,
        discussingScope: discussingScopeResult.count || 0,
        proposalDelivered: proposalDeliveredResult.count || 0,
        total: totalCount || 0,
      };

      setStatusCounts(counts);
    } catch (error) {
      console.error("Error fetching unfiltered status counts:", error);
    }
  }, [profile?.tenant_id]);

  // Fetch filtered status counts for stats cards (with filters applied)
  const fetchFilteredStatusCounts = useCallback(async () => {
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
        baseQuery = baseQuery.ilike("company_name", `${companySearch.trim()}%`);
      }

      // Apply warm connection search filter (if provided)
      if (warmConnectionSearch.trim()) {
        baseQuery = baseQuery.ilike("warm_connections", `${warmConnectionSearch.trim()}%`);
      }

      // Apply commodity search filter (if provided)
      if (commoditySearch.trim()) {
        baseQuery = baseQuery.ilike("commodity_fields", `${commoditySearch.trim()}%`);
      }

      // Apply tier filter
      if (tierFilter !== "all") {
        baseQuery = baseQuery.eq("tier", tierFilter);
      }

      // Apply company size filter
      if (companySizeFilter !== "all") {
        baseQuery = baseQuery.eq("company_size_interval", companySizeFilter);
      }

      // Apply market cap filter (unknown only - brackets filtered client-side)
      if (marketCapFilter !== "all" && marketCapFilter === "unknown") {
        baseQuery = baseQuery.or("market_capitalisation.is.null,market_capitalisation.eq.Unknown,market_capitalisation.eq.null");
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

        // Apply ignored filter
        if (!showIgnored) {
          query = query.neq("status", "ignored");
        }

        if (companySearch.trim()) {
          query = query.ilike("company_name", `${companySearch.trim()}%`);
        }
        if (warmConnectionSearch.trim()) {
          query = query.ilike("warm_connections", `${warmConnectionSearch.trim()}%`);
        }
        if (commoditySearch.trim()) {
          query = query.ilike("commodity_fields", `${commoditySearch.trim()}%`);
        }

        // Apply tier filter
        if (tierFilter !== "all") {
          query = query.eq("tier", tierFilter);
        }

        // Apply company size filter
        if (companySizeFilter !== "all") {
          query = query.eq("company_size_interval", companySizeFilter);
        }

        // Apply market cap filter (unknown only)
        if (marketCapFilter !== "all" && marketCapFilter === "unknown") {
          query = query.or("market_capitalisation.is.null,market_capitalisation.eq.Unknown,market_capitalisation.eq.null");
        }

        return query;
      };

      // Fetch counts for each status in parallel
      const [contactedResult, discussingScopeResult, proposalDeliveredResult] = await Promise.all([
        buildStatusQuery("contacted"),
        buildStatusQuery("discussing_scope"),
        buildStatusQuery("proposal_delivered"),
      ]);

      const counts = {
        contacted: contactedResult.count || 0,
        discussingScope: discussingScopeResult.count || 0,
        proposalDelivered: proposalDeliveredResult.count || 0,
        total: totalCount || 0,
      };

      setFilteredStatusCounts(counts);
    } catch (error) {
      console.error("Error fetching filtered status counts:", error);
    }
  }, [profile?.tenant_id, companySearch, warmConnectionSearch, commoditySearch, showIgnored, tierFilter, companySizeFilter, marketCapFilter]);

  // Reset to page 1 when filters or sort change and refetch filtered status counts
  useEffect(() => {
    setCurrentPage(1);
    if (profile?.tenant_id) {
      fetchFilteredStatusCounts();
    }
  }, [statusFilter, companySearch, warmConnectionSearch, commoditySearch, showIgnored, sortColumn, sortDirection, profile?.tenant_id, fetchFilteredStatusCounts]);

  useEffect(() => {
    // Fetch leads for user's tenant (all users have tenant_id now)
    if (profile?.tenant_id) {
      fetchFieldVisibility();
      fetchLeads();
      fetchAllLeadsCount();
      fetchUnfilteredStatusCounts();
      fetchFilteredStatusCounts();
    } else {
      setLeads([]);
      setLoading(false);
    }
  }, [profile?.tenant_id, fetchFieldVisibility, fetchLeads, fetchAllLeadsCount, fetchUnfilteredStatusCounts, fetchFilteredStatusCounts]);

  // Refetch when navigating back to this page
  useEffect(() => {
    const DEFAULT_TENANT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    if (location.pathname === "/" && profile?.tenant_id && profile.tenant_id !== DEFAULT_TENANT_ID && !loading) {
      fetchFieldVisibility();
      fetchLeads();
      fetchAllLeadsCount();
      fetchUnfilteredStatusCounts();
      fetchFilteredStatusCounts();
    } else if (profile?.tenant_id === DEFAULT_TENANT_ID) {
      setLeads([]);
      setLoading(false);
    }
  }, [location.pathname, profile?.tenant_id, fetchFieldVisibility, fetchLeads, fetchAllLeadsCount, fetchUnfilteredStatusCounts, fetchFilteredStatusCounts]);

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
        fetchUnfilteredStatusCounts();
        fetchFilteredStatusCounts();
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
        fetchUnfilteredStatusCounts();
        fetchFilteredStatusCounts();
      }

      toast.success("Status updated successfully");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: unsorted -> asc -> desc -> unsorted
      if (sortDirection === null) {
        setSortDirection("asc");
      } else if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        // desc -> unsorted
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      // Set new column and start with ascending
      setSortColumn(column);
      setSortDirection("asc");
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

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      companySearch.trim() !== "" ||
      warmConnectionSearch.trim() !== "" ||
      commoditySearch.trim() !== "" ||
      statusFilter !== "all" ||
      tierFilter !== "all" ||
      companySizeFilter !== "all" ||
      marketCapFilter !== "all" ||
      showIgnored === true
    );
  }, [companySearch, warmConnectionSearch, commoditySearch, statusFilter, tierFilter, companySizeFilter, marketCapFilter, showIgnored]);

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
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  LeadFlow
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">Track and manage your lead pipeline with precision</p>
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

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Stats cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          <div className="rounded-lg bg-card p-4 border border-border hover:border-border/80 transition-colors">
            <div className="text-sm font-medium text-muted-foreground mb-1">Total Leads</div>
            <div className="text-2xl font-semibold tabular-nums">
              {statusCounts.total}
              {hasActiveFilters && (
                <span className="text-sm text-muted-foreground font-normal ml-1.5">
                  ({filteredStatusCounts.total})
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 border border-border hover:border-border/80 transition-colors">
            <div className="text-sm font-medium text-muted-foreground mb-1">Contacted</div>
            <div className="text-2xl font-semibold tabular-nums text-sky-600">
              {statusCounts.contacted}
              {hasActiveFilters && (
                <span className="text-sm text-muted-foreground font-normal ml-1.5">
                  ({filteredStatusCounts.contacted})
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 border border-border hover:border-border/80 transition-colors">
            <div className="text-sm font-medium text-muted-foreground mb-1">Discussing Scope</div>
            <div className="text-2xl font-semibold tabular-nums text-amber-600">
              {statusCounts.discussingScope}
              {hasActiveFilters && (
                <span className="text-sm text-muted-foreground font-normal ml-1.5">
                  ({filteredStatusCounts.discussingScope})
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg bg-card p-4 border border-border hover:border-border/80 transition-colors">
            <div className="text-sm font-medium text-muted-foreground mb-1">Proposal Delivered</div>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600">
              {statusCounts.proposalDelivered}
              {hasActiveFilters && (
                <span className="text-sm text-muted-foreground font-normal ml-1.5">
                  ({filteredStatusCounts.proposalDelivered})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filters section */}
        <div className="mb-12 space-y-3 w-full">
          {/* Search filters row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search warm connections..."
                value={warmConnectionSearch}
                onChange={(e) => setWarmConnectionSearch(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search commodities..."
                value={commoditySearch}
                onChange={(e) => setCommoditySearch(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
          </div>
          {/* Dropdown filters row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full flex-wrap">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as LeadStatus | "all")}
            >
              <SelectTrigger className="flex-1 min-w-[150px] sm:min-w-[160px] h-9">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_contacted">Not Contacted</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="discussing_scope">Discussing Scope</SelectItem>
                <SelectItem value="proposal_delivered">Proposal Delivered</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={tierFilter}
              onValueChange={(value) => setTierFilter(value as LeadTier | "all")}
            >
              <SelectTrigger className="flex-1 min-w-[130px] sm:min-w-[140px] h-9">
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="1st">1st Degree</SelectItem>
                <SelectItem value="2nd">2nd Degree</SelectItem>
                <SelectItem value="3rd">3rd Degree</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={companySizeFilter}
              onValueChange={(value) => setCompanySizeFilter(value)}
            >
              <SelectTrigger className="flex-1 min-w-[160px] sm:min-w-[170px] h-9">
                <SelectValue placeholder="Filter by company size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="<500">&lt;500 employees</SelectItem>
                <SelectItem value="1000-5000">1,000-5,000 employees</SelectItem>
                <SelectItem value="5000-10000">5,000-10,000 employees</SelectItem>
                <SelectItem value="10000+">10,000+ employees</SelectItem>
                <SelectItem value="Unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={marketCapFilter}
              onValueChange={(value) => setMarketCapFilter(value)}
            >
              <SelectTrigger className="flex-1 min-w-[160px] sm:min-w-[170px] h-9">
                <SelectValue placeholder="Filter by market cap" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Market Caps</SelectItem>
                <SelectItem value="under_100m">Under $100M</SelectItem>
                <SelectItem value="100m_500m">$100M - $500M</SelectItem>
                <SelectItem value="500m_1b">$500M - $1B</SelectItem>
                <SelectItem value="1b_10b">$1B - $10B</SelectItem>
                <SelectItem value="10b_50b">$10B - $50B</SelectItem>
                <SelectItem value="over_50b">Over $50B</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && !error && leads.length > 0 && totalFilteredLeads > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between w-full gap-2 sm:gap-4">
            {/* Show ignored leads */}
            <div className="flex items-center gap-2 whitespace-nowrap">
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
                Show ignored
              </Label>
            </div>

            {/* Showing X to X of Y leads */}
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              Showing {startIndex}-{endIndex} of {totalFilteredLeads} leads
            </div>

            {/* Number of leads per page */}
            <div className="min-w-[150px]">
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full h-8 text-sm px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                  <SelectItem value="200">200 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pagination */}
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

            {/* Export button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="h-8 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Loading leads...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <h3 className="text-base font-medium text-destructive mb-1">Error Loading Leads</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              Retry
            </Button>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
            <h3 className="text-base font-medium mb-1">No Leads Available</h3>
            <p className="text-sm text-muted-foreground">
              No leads found. Try adjusting your filters or add new leads.
            </p>
          </div>
        ) : (
          <>
            <LeadsTable
              leads={filteredLeads}
              onStatusChange={handleStatusChange}
              onAddComment={handleAddComment}
              fieldVisibility={fieldVisibility}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
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
