import { useState, Fragment } from "react";
import { Lead, LeadStatus } from "@/types/lead";
import { useNavigate } from "react-router-dom";
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
import { MessageSquare, X, Send, Mail, MapPin, Building2, ArrowUpDown, ArrowUp, ArrowDown, MessageSquareText } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";
import { EmailDialog } from "@/components/EmailDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useAuth } from "@/contexts/AuthContext";

interface LeadsTableProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onAddComment: (leadId: string, comment: string) => void;
}

type SortColumn = "companyName" | "contactPerson" | "role" | "tier" | "status" | "createdAt" | null;
type SortDirection = "asc" | "desc" | null;

export function LeadsTable({ leads, onStatusChange, onAddComment }: LeadsTableProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [commentingLead, setCommentingLead] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  const handleCompanyClick = (companyName: string) => {
    navigate(`/company/${encodeURIComponent(companyName)}`);
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
    const commentText = `Marked as ${qualityText} lead by ${userName}. Reason: ${reason}`;

    onAddComment(selectedLead.id, commentText);
    toast.success(`Lead marked as ${qualityText} quality`);
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

  const sortedLeads = [...leads].sort((a, b) => {
    // If no sort column, default to newest first (createdAt desc)
    if (!sortColumn || sortDirection === null) {
      return b.createdAt.getTime() - a.createdAt.getTime();
    }

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "companyName":
        aValue = a.companyName.toLowerCase();
        bValue = b.companyName.toLowerCase();
        break;
      case "contactPerson":
        aValue = a.contactPerson.toLowerCase();
        bValue = b.contactPerson.toLowerCase();
        break;
      case "role":
        aValue = a.role.toLowerCase();
        bValue = b.role.toLowerCase();
        break;
      case "tier":
        aValue = a.tier;
        bValue = b.tier;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "createdAt":
        aValue = a.createdAt.getTime();
        bValue = b.createdAt.getTime();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

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
    <div className="rounded-xl border border-border/50 bg-card shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-border/60 hover:bg-transparent">
              <TableHead 
                className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("companyName")}
              >
                <div className="flex items-center">
                  Company
                  <SortIcon column="companyName" />
                </div>
              </TableHead>
              <TableHead className="h-14 font-semibold text-sm min-w-[200px] max-w-[250px]">Details</TableHead>
              <TableHead
                className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("contactPerson")}
              >
                <div className="flex items-center">
                  Contact Person
                  <SortIcon column="contactPerson" />
                </div>
              </TableHead>
              <TableHead 
                className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort("role")}
              >
                <div className="flex items-center">
                  Role
                  <SortIcon column="role" />
                </div>
              </TableHead>
              <TableHead 
                className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors w-[100px]"
                onClick={() => handleSort("tier")}
              >
                <div className="flex items-center">
                  Tier
                  <SortIcon column="tier" />
                </div>
              </TableHead>
              <TableHead 
                className="h-14 font-semibold text-sm cursor-pointer hover:bg-muted/50 transition-colors w-[140px]"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">
                  Status
                  <SortIcon column="status" />
                </div>
              </TableHead>
              <TableHead className="h-14 font-semibold text-sm min-w-[150px] max-w-[200px]">Warm Connections</TableHead>
              <TableHead className="h-14 font-semibold text-sm text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.map((lead, index) => (
              <Fragment key={lead.id}>
                <TableRow 
                  className={`group border-b border-border/50 hover:bg-success/8 hover:border-success/40 transition-all duration-200 cursor-pointer ${
                    isNewLead(lead) ? "border-l-4 border-l-success bg-success/5" : ""
                  } ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                >
                  <TableCell className="py-5 px-4">
                    <button
                      onClick={() => handleCompanyClick(lead.companyName)}
                      className="font-semibold text-primary hover:text-primary/80 hover:underline transition-colors text-left"
                    >
                      {lead.companyName}
                    </button>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[250px]">
                      {lead.company?.description && (
                        <span className="inline-flex items-start gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                          {lead.company.description}
                        </span>
                      )}
                      {lead.company && (lead.company.industry || lead.company.location) && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {lead.company.industry && lead.company.industry !== "Unknown" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                              <Building2 className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{lead.company.industry}</span>
                            </span>
                          )}
                          {lead.company.location && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{lead.company.location}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <span className="text-sm">{lead.contactPerson}</span>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <span className="text-sm">{lead.role}</span>
                  </TableCell>
                  <TableCell className="py-5 px-4 w-[100px]">
                    <TierBadge tier={lead.tier} />
                  </TableCell>
                  <TableCell className="py-5 px-4 w-[140px]">
                    <Select
                      value={lead.status}
                      onValueChange={(value) => onStatusChange(lead.id, value as LeadStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-9 border-border/50">
                        <SelectValue>
                          <StatusBadge status={lead.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_contacted">Not Contacted</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed_won">Closed Won</SelectItem>
                        <SelectItem value="closed_lost">Closed Lost</SelectItem>
                        <SelectItem value="ignored">Ignored</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-5 px-4 min-w-[150px] max-w-[200px]">
                    {lead.warmConnections ? (
                      <span className="text-xs text-muted-foreground block line-clamp-2">
                        {lead.warmConnections}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic">None</span>
                    )}
                  </TableCell>
                  <TableCell className="py-5 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEmailDialog(lead)}
                        title="Send Email"
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-success hover:bg-success/10 transition-all duration-200"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenFeedbackDialog(lead)}
                        title="Provide Feedback"
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                      >
                        <MessageSquareText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCommentingLead(commentingLead === lead.id ? null : lead.id)}
                        title={commentingLead === lead.id ? "Close Comments" : "View/Add Comments"}
                        className={`h-9 w-9 p-0 relative transition-all duration-200 ${
                          commentingLead === lead.id
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
                    </div>
                  </TableCell>
                </TableRow>
                {commentingLead === lead.id && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-success/5 p-6 border-b border-border/50">
                      <div className="space-y-4">
                        {lead.comments.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-foreground mb-3">Comments ({lead.comments.length})</h4>
                            {lead.comments.map((comment) => (
                              <div key={comment.id} className="rounded-lg bg-card p-4 border border-border/50 shadow-soft">
                                <p className="text-sm leading-relaxed text-foreground">{comment.text}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {comment.author} • {new Date(comment.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
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
