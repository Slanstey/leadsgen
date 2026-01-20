import { useState, Fragment } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X, Send, Mail, MapPin, Building2, ArrowUpDown, ArrowUp, ArrowDown, MessageSquareText, Link2, Edit2, Trash2 } from "lucide-react";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";
import { EmailDialog } from "@/components/EmailDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { FieldVisibilityConfig, defaultFieldVisibility } from "@/types/tenantPreferences";

type SortColumn = "companyName" | "contactPerson" | "contactEmail" | "role" | "tier" | "status" | "followsOnLinkedin" | "createdAt" | "marketCapitalisation" | "companySizeInterval" | "lastCommentDate" | null;
type SortDirection = "asc" | "desc" | null;

const statusConfig: Record<
  LeadStatus,
  {
    label: string;
    triggerClass: string;
    itemClass: string;
  }
> = {
  not_contacted: {
    label: "Not Contacted",
    triggerClass:
      "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100 border-transparent",
    itemClass:
      "bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100 data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-800",
  },
  contacted: {
    label: "Contacted",
    triggerClass:
      "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100 border-transparent",
    itemClass:
      "bg-sky-50 text-sky-800 dark:bg-sky-900 dark:text-sky-100 data-[highlighted]:bg-sky-100 dark:data-[highlighted]:bg-sky-800",
  },
  discussing_scope: {
    label: "Discussing Scope",
    triggerClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-transparent",
    itemClass:
      "bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-100 data-[highlighted]:bg-blue-100 dark:data-[highlighted]:bg-blue-800",
  },
  proposal_delivered: {
    label: "Proposal Delivered",
    triggerClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 border-transparent",
    itemClass:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 data-[highlighted]:bg-emerald-100 dark:data-[highlighted]:bg-emerald-800",
  },
  ignored: {
    label: "Ignored",
    triggerClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 border-transparent",
    itemClass:
      "bg-amber-50 text-amber-800 dark:bg-amber-900 dark:text-amber-100 data-[highlighted]:bg-amber-100 dark:data-[highlighted]:bg-amber-800",
  },
};

interface LeadsTableProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onAddComment: (leadId: string, comment: string) => void;
  onEditComment?: (commentId: string, newText: string) => void;
  onDeleteComment?: (commentId: string) => void;
  fieldVisibility?: FieldVisibilityConfig;
  sortColumn?: SortColumn;
  sortDirection?: SortDirection;
  onSort?: (column: SortColumn) => void;
}

export function LeadsTable({ leads, onStatusChange, onAddComment, onEditComment, onDeleteComment, fieldVisibility, sortColumn = null, sortDirection = null, onSort }: LeadsTableProps) {
  const { profile } = useAuth();
  const [commentingLead, setCommentingLead] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const visibility = fieldVisibility || defaultFieldVisibility;
  // Calculate visible columns - industry/location/description count as one column if any are visible
  const hasCompanyDetails = visibility.industry || visibility.location || visibility.description;
  // Actions column is visible only if at least one action is enabled
  const hasActions = visibility.actionEmail || visibility.actionFeedback || visibility.actionComments;
  // Last Modified column visibility is controlled by field visibility setting
  const showLastModified = visibility.lastModified;
  const visibleColumnCount =
    (visibility.company ? 1 : 0) +
    (hasCompanyDetails ? 1 : 0) +
    (visibility.contactPerson ? 1 : 0) +
    (visibility.contactEmail ? 1 : 0) +
    (visibility.role ? 1 : 0) +
    (visibility.tier ? 1 : 0) +
    (visibility.status ? 1 : 0) +
    (visibility.warmConnections ? 1 : 0) +
    (visibility.followsOnLinkedin ? 1 : 0) +
    (visibility.marketCapitalisation ? 1 : 0) +
    (visibility.companySizeInterval ? 1 : 0) +
    (visibility.commodityFields ? 1 : 0) +
    (showLastModified ? 1 : 0) +
    (hasActions ? 1 : 0) || 1;

  // Helper function to get the last comment date
  const getLastCommentDate = (lead: Lead): Date | null => {
    if (lead.comments.length === 0) return null;
    return new Date(Math.max(...lead.comments.map(c => c.createdAt.getTime())));
  };

  const isNewLead = (lead: Lead): boolean => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return lead.createdAt >= threeDaysAgo;
  };

  const handleAddComment = (leadId: string) => {
    if (commentText.trim()) {
      onAddComment(leadId, commentText);
      setCommentText("");
      setCommentingLead(null);
      toast.success("Comment added successfully");
    }
  };

  const handleOpenEmailDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setEmailDialogOpen(true);
  };

  const handleEmailSent = (emailContent: string) => {
    if (selectedLead) {
      onAddComment(selectedLead.id, `Email sent:\n\n${emailContent}`);
      onStatusChange(selectedLead.id, "contacted");
    }
  };

  const handleOpenFeedbackDialog = (lead: Lead) => {
    setSelectedLead(lead);
    setFeedbackDialogOpen(true);
  };

  const handleFeedbackSubmit = (quality: "good" | "bad", reason: string) => {
    if (!selectedLead) return;

    const userName = profile?.full_name || profile?.email || "Current User";
    const qualityText = quality === "good" ? "good" : "bad";
    const commentText = `Marked as ${qualityText} lead by ${userName}.\n\nReason: ${reason}`;

    onAddComment(selectedLead.id, commentText);
    toast.success(`Lead marked as ${qualityText} quality`);
  };

  const handleSort = (column: SortColumn) => {
    if (onSort) {
      onSort(column);
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    }
    if (sortDirection === null) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1" />
    );
  };

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-16 text-center shadow-soft">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground text-base">No leads found. Leads will appear here once they are generated.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-soft overflow-hidden w-full">
      <div className="overflow-x-auto w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="border-b-2 border-border/60 hover:bg-transparent">
              {visibility.company && (
                <TableHead
                  className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors min-w-[120px]"
                  onClick={() => handleSort("companyName")}
                >
                  <div className="flex items-center">
                    Company
                    <SortIcon column="companyName" />
                  </div>
                </TableHead>
              )}
              {(visibility.industry || visibility.location || visibility.description) && (
                <TableHead className="h-14 font-semibold text-sm w-[180px]">
                  Location
                </TableHead>
              )}
              {visibility.contactPerson && (
                <TableHead
                  className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors min-w-[100px]"
                  onClick={() => handleSort("contactPerson")}
                >
                  <div className="flex items-center">
                    Lead
                    <SortIcon column="contactPerson" />
                  </div>
                </TableHead>
              )}
              {/* Email column header - disabled
              {visibility.contactEmail && (
                <TableHead
                  className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors w-[180px]"
                  onClick={() => handleSort("contactEmail")}
                >
                  <div className="flex items-center">
                    Email
                    <SortIcon column="contactEmail" />
                  </div>
                </TableHead>
              )}
              */}
              {visibility.role && (
                <TableHead
                  className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors min-w-[100px]"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex items-center">
                    Role
                    <SortIcon column="role" />
                  </div>
                </TableHead>
              )}
              {visibility.tier && (
                <TableHead
                  className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors w-[90px]"
                  onClick={() => handleSort("tier")}
                >
                  <div className="flex items-center">
                    Tier
                    <SortIcon column="tier" />
                  </div>
                </TableHead>
              )}
              {visibility.status && (
                <TableHead
                  className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors w-[130px]"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
              )}
              {visibility.warmConnections && (
                <TableHead className="h-14 font-semibold text-sm w-[140px]">
                  Warm Connections
                </TableHead>
              )}
              {visibility.followsOnLinkedin && (
                <TableHead
                  className="h-14 font-semibold text-sm w-[110px] cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("followsOnLinkedin")}
                >
                  <div className="flex items-center">
                    Follows You
                    <SortIcon column="followsOnLinkedin" />
                  </div>
                </TableHead>
              )}
              {visibility.marketCapitalisation && (
                <TableHead
                  className="h-14 font-semibold text-sm w-[120px] cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("marketCapitalisation")}
                >
                  <div className="flex items-center">
                    Market Cap
                    <SortIcon column="marketCapitalisation" />
                  </div>
                </TableHead>
              )}
              {visibility.companySizeInterval && (
                <TableHead
                  className="h-14 font-semibold text-sm w-[120px] cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("companySizeInterval")}
                >
                  <div className="flex items-center">
                    Company Size
                    <SortIcon column="companySizeInterval" />
                  </div>
                </TableHead>
              )}
              {visibility.commodityFields && (
                <TableHead className="h-14 font-semibold text-sm w-[130px]">
                  Commodities
                </TableHead>
              )}
              {/* LinkedIn Connected column - disabled
              {visibility.isConnectedToTenant && (
                <TableHead className="h-14 font-semibold text-sm w-[140px]">
                  LinkedIn Connected
                </TableHead>
              )}
              */}
              {showLastModified && (
                <TableHead
                  className="h-14 font-semibold text-sm w-[140px] cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("lastCommentDate")}
                >
                  <div className="flex items-center">
                    Last Modified
                    <SortIcon column="lastCommentDate" />
                  </div>
                </TableHead>
              )}
              {hasActions && (
                <TableHead className="h-14 font-semibold text-sm text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => (
              <Fragment key={lead.id}>
                <TableRow
                  className={`group border-b border-border/50 hover:bg-success/8 hover:border-success/40 transition-all duration-200 ${isNewLead(lead) ? "border-l-4 border-l-success bg-success/5" : ""
                    } ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                >
                  {visibility.company && (
                    <TableCell className="py-5 px-4 min-w-[120px]">
                      <span className="font-semibold text-foreground">
                        {lead.companyName}
                      </span>
                    </TableCell>
                  )}
                  {(visibility.industry || visibility.location || visibility.description) && (
                    <TableCell className="py-5 px-4">
                      <div className="flex flex-col gap-1.5 w-[180px]">
                        {visibility.description && lead.company?.description && (
                          <span className="inline-flex items-start gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                            {lead.company.description}
                          </span>
                        )}
                        {lead.company && ((visibility.industry && lead.company.industry) || (visibility.location && lead.company.location)) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {visibility.industry && lead.company.industry && lead.company.industry !== "Unknown" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                                <Building2 className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate max-w-[120px]">{lead.company.industry}</span>
                              </span>
                            )}
                            {visibility.location && lead.company.location && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate max-w-[120px]">{lead.company.location}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {visibility.contactPerson && (
                    <TableCell className="py-5 px-4">
                      <span className="text-sm">{lead.contactPerson}</span>
                    </TableCell>
                  )}
                  {/* Email column cell - disabled
                  {visibility.contactEmail && (
                    <TableCell className="py-5 px-4 w-[180px]">
                      {lead.contactEmail ? (
                        <a
                          href={`mailto:${lead.contactEmail}`}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group/email"
                        >
                          <Mail className="h-3.5 w-3.5 opacity-60 group-hover/email:opacity-100 group-hover/email:text-primary transition-all flex-shrink-0" />
                          <span className="hover:underline truncate">{lead.contactEmail}</span>
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground/50 italic">No email</span>
                      )}
                    </TableCell>
                  )}
                  */}
                  {visibility.role && (
                    <TableCell className="py-5 px-4 min-w-[100px]">
                      <span className="text-sm">{lead.role}</span>
                    </TableCell>
                  )}
                  {visibility.tier && (
                    <TableCell className="py-5 px-4 w-[90px]">
                      <TierBadge tier={lead.tier} />
                    </TableCell>
                  )}
                  {visibility.status && (
                    <TableCell className="py-5 px-4 w-[130px]">
                      {(() => {
                        const config = statusConfig[lead.status];
                        return (
                          <Select
                            value={lead.status}
                            onValueChange={(value) => onStatusChange(lead.id, value as LeadStatus)}
                          >
                            <SelectTrigger
                              className={cn(
                                "w-[120px] h-9 text-xs font-medium px-3 border border-transparent",
                                config?.triggerClass
                              )}
                            >
                              <SelectValue>
                                <span className="truncate">
                                  {config?.label ?? lead.status}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                value="not_contacted"
                                className={cn(
                                  "text-xs font-medium",
                                  statusConfig.not_contacted.itemClass
                                )}
                              >
                                {statusConfig.not_contacted.label}
                              </SelectItem>
                              <SelectItem
                                value="contacted"
                                className={cn(
                                  "text-xs font-medium",
                                  statusConfig.contacted.itemClass
                                )}
                              >
                                {statusConfig.contacted.label}
                              </SelectItem>
                              <SelectItem
                                value="discussing_scope"
                                className={cn(
                                  "text-xs font-medium",
                                  statusConfig.discussing_scope.itemClass
                                )}
                              >
                                {statusConfig.discussing_scope.label}
                              </SelectItem>
                              <SelectItem
                                value="proposal_delivered"
                                className={cn(
                                  "text-xs font-medium",
                                  statusConfig.proposal_delivered.itemClass
                                )}
                              >
                                {statusConfig.proposal_delivered.label}
                              </SelectItem>
                              <SelectItem
                                value="ignored"
                                className={cn(
                                  "text-xs font-medium",
                                  statusConfig.ignored.itemClass
                                )}
                              >
                                {statusConfig.ignored.label}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                  )}
                  {visibility.warmConnections && (
                    <TableCell className="py-5 px-4 w-[140px]">
                      {lead.warmConnections ? (
                        <span className="text-xs text-muted-foreground block line-clamp-2">
                          {lead.warmConnections}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">None</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.followsOnLinkedin && (
                    <TableCell className="py-5 px-4 w-[110px]">
                      {lead.followsOnLinkedin ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 text-xs font-medium">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-xs">
                          No
                        </span>
                      )}
                    </TableCell>
                  )}
                  {visibility.marketCapitalisation && (
                    <TableCell className="py-5 px-4 w-[120px]">
                      {lead.marketCapitalisation ? (
                        <span className="text-sm">{lead.marketCapitalisation}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">-</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.companySizeInterval && (
                    <TableCell className="py-5 px-4 w-[120px]">
                      {lead.companySizeInterval ? (
                        <span className="text-sm">{lead.companySizeInterval}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">-</span>
                      )}
                    </TableCell>
                  )}
                  {visibility.commodityFields && (
                    <TableCell className="py-5 px-4 w-[130px]">
                      {lead.commodityFields ? (
                        <span className="text-xs text-muted-foreground block line-clamp-2">{lead.commodityFields}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">-</span>
                      )}
                    </TableCell>
                  )}
                  {/* LinkedIn Connected cell - disabled
                  {visibility.isConnectedToTenant && (
                    <TableCell className="py-5 px-4 w-[140px]">
                      {lead.isConnectedToTenant ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs font-medium">
                          <Link2 className="h-3 w-3" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-xs">
                          Not Connected
                        </span>
                      )}
                    </TableCell>
                  )}
                  */}
                  {showLastModified && (
                    <TableCell className="py-5 px-4 w-[140px]">
                      {(() => {
                        const lastCommentDate = getLastCommentDate(lead);
                        if (!lastCommentDate) {
                          return <span className="text-xs text-muted-foreground/50 italic">-</span>;
                        }
                        const now = new Date();
                        const diffMs = now.getTime() - lastCommentDate.getTime();
                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                        let displayText: string;
                        if (diffDays === 0) {
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                          if (diffHours === 0) {
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            displayText = diffMins <= 1 ? "Just now" : `${diffMins}m ago`;
                          } else {
                            displayText = `${diffHours}h ago`;
                          }
                        } else if (diffDays === 1) {
                          displayText = "Yesterday";
                        } else if (diffDays < 7) {
                          displayText = `${diffDays}d ago`;
                        } else {
                          displayText = lastCommentDate.toLocaleDateString();
                        }

                        return (
                          <span className="text-xs text-muted-foreground" title={lastCommentDate.toLocaleString()}>
                            {displayText}
                          </span>
                        );
                      })()}
                    </TableCell>
                  )}
                  {hasActions && (
                    <TableCell className="py-5 px-4 text-right w-[120px]">
                      <div className="flex justify-end gap-2">
                        {visibility.actionEmail && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEmailDialog(lead)}
                            title="Send Email"
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-success hover:bg-success/10 transition-all duration-200"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {visibility.actionFeedback && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFeedbackDialog(lead)}
                            title="Provide Feedback"
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                          >
                            <MessageSquareText className="h-4 w-4" />
                          </Button>
                        )}
                        {visibility.actionComments && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCommentingLead(commentingLead === lead.id ? null : lead.id)}
                            title={commentingLead === lead.id ? "Close Comments" : "View/Add Comments"}
                            className={`h-9 w-9 p-0 relative transition-all duration-200 ${commentingLead === lead.id
                              ? "text-success bg-success/10"
                              : lead.comments.length > 0
                                ? "text-primary hover:text-success hover:bg-success/10"
                                : "text-muted-foreground hover:text-success hover:bg-success/10"
                              }`}
                          >
                            {commentingLead === lead.id ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4" />
                                {lead.comments.length > 0 && (
                                  <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[10px] font-semibold text-primary-foreground bg-primary rounded-full">
                                    {lead.comments.length}
                                  </span>
                                )}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {commentingLead === lead.id && (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className="bg-success/5 p-6 border-b border-border/50">
                      <div className="space-y-4">
                        {lead.comments.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-foreground mb-3">Comments ({lead.comments.length})</h4>
                            {lead.comments.map((comment) => {
                              // Check if current user is the author of this comment
                              // Author is stored as: profile.full_name || profile.email || "Current User"
                              const currentUserName = profile?.full_name || profile?.email || "Current User";
                              const isCommentAuthor =
                                comment.author === currentUserName ||
                                comment.author === profile?.full_name ||
                                comment.author === profile?.email ||
                                (comment.author === "Current User" && !profile?.full_name && !profile?.email);

                              return (
                                <div key={comment.id} className="rounded-lg bg-card p-4 border border-border/50 shadow-soft">
                                  {editingCommentId === comment.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editingCommentText}
                                        onChange={(e) => setEditingCommentText(e.target.value)}
                                        className="min-h-[80px] bg-background resize-none"
                                      />
                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingCommentId(null);
                                            setEditingCommentText("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            if (onEditComment && editingCommentText.trim()) {
                                              onEditComment(comment.id, editingCommentText.trim());
                                              setEditingCommentId(null);
                                              setEditingCommentText("");
                                            }
                                          }}
                                          disabled={!editingCommentText.trim()}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-sm leading-relaxed text-foreground">{comment.text}</p>
                                      <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-muted-foreground">
                                          {comment.author} • {new Date(comment.createdAt).toLocaleDateString()}
                                        </p>
                                        {isCommentAuthor && (onEditComment || onDeleteComment) && (
                                          <div className="flex gap-2">
                                            {onEditComment && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  setEditingCommentId(comment.id);
                                                  setEditingCommentText(comment.text);
                                                }}
                                                className="h-7 px-2 text-xs"
                                              >
                                                <Edit2 className="h-3 w-3 mr-1" />
                                                Edit
                                              </Button>
                                            )}
                                            {onDeleteComment && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  if (confirm("Are you sure you want to delete this comment?")) {
                                                    onDeleteComment(comment.id);
                                                  }
                                                }}
                                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                              >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Delete
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Textarea
                            placeholder="Add a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            className="min-h-[100px] bg-background resize-none"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAddComment(lead.id)}
                            disabled={!commentText.trim()}
                            className="h-[100px] px-4 bg-primary hover:bg-primary/90"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedLead && (
        <>
          <EmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            companyName={selectedLead.companyName}
            contactPerson={selectedLead.contactPerson}
            contactEmail={selectedLead.contactEmail}
            role={selectedLead.role}
            onEmailSent={handleEmailSent}
          />
          <FeedbackDialog
            open={feedbackDialogOpen}
            onOpenChange={setFeedbackDialogOpen}
            companyName={selectedLead.companyName}
            contactPerson={selectedLead.contactPerson}
            onFeedbackSubmit={handleFeedbackSubmit}
          />
        </>
      )}
    </div>
  );
}
