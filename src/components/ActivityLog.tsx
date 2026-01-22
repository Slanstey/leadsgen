import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/lib/supabaseUtils";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLogEntry {
  id: string;
  description: string;
  action_type: string;
  created_at: string;
  user_id: string;
  lead_id: string;
  user_name?: string;
  lead_company?: string;
  lead_contact?: string;
}

interface ActivityLogProps {
  limit?: number;
  className?: string;
  isOpen?: boolean;
  onActivityClick?: (companyName: string, contactPerson: string) => void;
}

export function ActivityLog({ limit = 50, className, isOpen = false, onActivityClick }: ActivityLogProps) {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }

    const fetchActivities = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch activity logs with user and lead information
        const { data: logsData, error: logsError } = await supabase
          .from(Tables.ACTIVITY_LOGS)
          .select(`
            id,
            description,
            action_type,
            created_at,
            user_id,
            lead_id,
            metadata
          `)
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (logsError) throw logsError;

        // Fetch user names for all unique user IDs
        const userIds = [...new Set((logsData || []).map((log) => log.user_id))];
        const usersMap = new Map<string, string>();

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from(Tables.USER_PROFILES)
            .select("id, full_name, email")
            .in("id", userIds);

          if (usersData) {
            usersData.forEach((user) => {
              usersMap.set(user.id, user.full_name || user.email || "Unknown User");
            });
          }
        }

        // Fetch lead information for all unique lead IDs
        const leadIds = [...new Set((logsData || []).map((log) => log.lead_id))];
        const leadsMap = new Map<string, { company: string; contact: string }>();

        if (leadIds.length > 0) {
          const { data: leadsData } = await supabase
            .from(Tables.LEADS)
            .select("id, company_name, contact_person")
            .in("id", leadIds);

          if (leadsData) {
            leadsData.forEach((lead) => {
              leadsMap.set(lead.id, {
                company: lead.company_name,
                contact: lead.contact_person,
              });
            });
          }
        }

        // Combine data
        const enrichedActivities: ActivityLogEntry[] = (logsData || []).map((log) => ({
          ...log,
          user_name: usersMap.get(log.user_id),
          lead_company: leadsMap.get(log.lead_id)?.company,
          lead_contact: leadsMap.get(log.lead_id)?.contact,
        }));

        setActivities(enrichedActivities);
      } catch (err) {
        console.error("Error fetching activity logs:", err);
        setError("Failed to load activity log");
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Set up real-time subscription for new activities
    const subscription = supabase
      .channel("activity_logs_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: Tables.ACTIVITY_LOGS,
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        async (payload) => {
          // Fetch the new activity with user and lead info
          const newLog = payload.new as ActivityLogEntry;
          
          // Fetch user name
          const { data: userData } = await supabase
            .from(Tables.USER_PROFILES)
            .select("full_name, email")
            .eq("id", newLog.user_id)
            .single();

          // Fetch lead info
          const { data: leadData } = await supabase
            .from(Tables.LEADS)
            .select("company_name, contact_person")
            .eq("id", newLog.lead_id)
            .single();

          const enrichedLog: ActivityLogEntry = {
            ...newLog,
            user_name: userData?.full_name || userData?.email || "Unknown User",
            lead_company: leadData?.company_name,
            lead_contact: leadData?.contact_person,
          };

          setActivities((prev) => [enrichedLog, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.tenant_id, limit]);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "comment_added":
        return "💬";
      case "comment_edited":
        return "✏️";
      case "comment_deleted":
        return "🗑️";
      case "status_changed":
        return "🔄";
      case "email_sent":
        return "📧";
      case "feedback_given":
        return "⭐";
      default:
        return "📝";
    }
  };

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border/50 bg-card p-8 shadow-soft", className)}>
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Loading activity log...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border border-border/50 bg-card p-8 shadow-soft", className)}>
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl bg-card shadow-soft overflow-hidden transition-all duration-200",
      isOpen 
        ? "border-2 border-primary" 
        : "border border-border/50",
      className
    )}>
      <div className="max-h-[500px] overflow-y-auto">
        <div className="p-3 space-y-2">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Activity will appear here as you interact with leads
              </p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  "rounded-lg border border-border/50 bg-background py-2 px-3 transition-colors duration-200",
                  onActivityClick && activity.lead_company && activity.lead_contact
                    ? "hover:bg-primary/10 hover:border-primary/50 cursor-pointer"
                    : "hover:bg-muted/30"
                )}
                onClick={() => {
                  if (onActivityClick && activity.lead_company && activity.lead_contact) {
                    onActivityClick(activity.lead_company, activity.lead_contact);
                  }
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 text-sm">
                    {getActionIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeAgo(activity.created_at)}</span>
                      </div>
                      {activity.user_name && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{activity.user_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
