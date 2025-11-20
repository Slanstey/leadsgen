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
import { MessageSquare, X, Send, Mail } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { TierBadge } from "@/components/TierBadge";
import { toast } from "sonner";
import { EmailDialog } from "@/components/EmailDialog";

interface LeadsTableProps {
  leads: Lead[];
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onAddComment: (leadId: string, comment: string) => void;
}

export function LeadsTable({ leads, onStatusChange, onAddComment }: LeadsTableProps) {
  const navigate = useNavigate();
  const [commentingLead, setCommentingLead] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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
              <TableHead className="h-14 font-semibold text-sm">Company</TableHead>
              <TableHead className="h-14 font-semibold text-sm">Contact Person</TableHead>
              <TableHead className="h-14 font-semibold text-sm">Email</TableHead>
              <TableHead className="h-14 font-semibold text-sm">Role</TableHead>
              <TableHead className="h-14 font-semibold text-sm">Tier</TableHead>
              <TableHead className="h-14 font-semibold text-sm">Status</TableHead>
              <TableHead className="h-14 font-semibold text-sm">Comments</TableHead>
              <TableHead className="h-14 font-semibold text-sm text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => (
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
                    <span className="text-sm">{lead.contactPerson}</span>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    {lead.contactEmail ? (
                      <a 
                        href={`mailto:${lead.contactEmail}`}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 group/email"
                      >
                        <Mail className="h-3.5 w-3.5 opacity-60 group-hover/email:opacity-100 group-hover/email:text-primary transition-all" />
                        <span className="hover:underline">{lead.contactEmail}</span>
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground/50 italic">No email</span>
                    )}
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <span className="text-sm">{lead.role}</span>
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <TierBadge tier={lead.tier} />
                  </TableCell>
                  <TableCell className="py-5 px-4">
                    <Select
                      value={lead.status}
                      onValueChange={(value) => onStatusChange(lead.id, value as LeadStatus)}
                    >
                      <SelectTrigger className="w-[160px] h-9 border-border/50">
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
                  <TableCell className="py-5 px-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className={`h-4 w-4 transition-colors ${
                        lead.comments.length > 0 
                          ? "text-primary opacity-70" 
                          : "text-muted-foreground opacity-40"
                      }`} />
                      <span className={`text-sm ${
                        lead.comments.length > 0 
                          ? "text-foreground font-medium" 
                          : "text-muted-foreground"
                      }`}>
                        {lead.comments.length}
                      </span>
                    </div>
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
                        onClick={() => setCommentingLead(commentingLead === lead.id ? null : lead.id)}
                        title={commentingLead === lead.id ? "Close Comments" : "View/Add Comments"}
                        className={`h-9 w-9 p-0 transition-all duration-200 ${
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
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {commentingLead === lead.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-success/5 p-6 border-b border-border/50">
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
        <EmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          companyName={selectedLead.companyName}
          contactPerson={selectedLead.contactPerson}
          contactEmail={selectedLead.contactEmail}
          role={selectedLead.role}
          onEmailSent={handleEmailSent}
        />
      )}
    </div>
  );
}
