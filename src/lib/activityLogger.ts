/**
 * Activity Logger Utility
 * Provides functions to log user actions on leads
 */

import { supabase } from "@/integrations/supabase/client";
import { Tables } from "./supabaseUtils";
import type { Lead, LeadStatus } from "@/types/lead";

export type ActivityActionType =
  | "comment_added"
  | "comment_edited"
  | "comment_deleted"
  | "status_changed"
  | "email_sent"
  | "feedback_given";

interface LogActivityParams {
  leadId: string;
  lead: Lead;
  actionType: ActivityActionType;
  userId: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

/**
 * Formats activity description based on action type and lead details
 */
function formatActivityDescription(
  actionType: ActivityActionType,
  userName: string,
  lead: Lead,
  metadata?: Record<string, any>
): string {
  const contactPerson = lead.contactPerson;
  const companyName = lead.companyName;

  switch (actionType) {
    case "comment_added":
      return `${userName} commented on ${contactPerson} from ${companyName}.`;

    case "comment_edited":
      return `${userName} edited a comment on ${contactPerson} from ${companyName}.`;

    case "comment_deleted":
      return `${userName} deleted a comment on ${contactPerson} from ${companyName}.`;

    case "status_changed":
      const oldStatus = metadata?.oldStatus as LeadStatus | undefined;
      const newStatus = metadata?.newStatus as LeadStatus | undefined;
      const statusLabels: Record<LeadStatus, string> = {
        not_contacted: "Not Contacted",
        contacted: "Contacted",
        discussing_scope: "Discussing Scope",
        proposal_delivered: "Proposal Delivered",
        ignored: "Ignored",
      };
      const oldStatusLabel = oldStatus ? statusLabels[oldStatus] : "Unknown";
      const newStatusLabel = newStatus ? statusLabels[newStatus] : "Unknown";
      return `${userName} changed the status of ${contactPerson} from ${companyName} from "${oldStatusLabel}" to "${newStatusLabel}".`;

    case "email_sent":
      return `${userName} sent an email to ${contactPerson} from ${companyName}.`;

    case "feedback_given":
      const quality = metadata?.quality as "good" | "bad" | undefined;
      const qualityText = quality === "good" ? "good" : "bad";
      return `${userName} marked ${contactPerson} from ${companyName} as a ${qualityText} lead.`;

    default:
      return `${userName} performed an action on ${contactPerson} from ${companyName}.`;
  }
}

/**
 * Logs an activity to the database
 */
export async function logActivity({
  leadId,
  lead,
  actionType,
  userId,
  tenantId,
  metadata = {},
}: LogActivityParams): Promise<void> {
  try {
    // Get user name for description
    const { data: userProfile } = await supabase
      .from(Tables.USER_PROFILES)
      .select("full_name, email")
      .eq("id", userId)
      .single();

    const userName = userProfile?.full_name || userProfile?.email || "Unknown User";

    const description = formatActivityDescription(actionType, userName, lead, metadata);

    const { error } = await supabase.from(Tables.ACTIVITY_LOGS).insert({
      tenant_id: tenantId,
      lead_id: leadId,
      user_id: userId,
      action_type: actionType,
      description,
      metadata,
    });

    if (error) {
      console.error("Error logging activity:", error);
      // Don't throw - activity logging should not break the main flow
    }
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw - activity logging should not break the main flow
  }
}
