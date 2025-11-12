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

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Comments</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <Fragment key={lead.id}>
              <TableRow>
                <TableCell>
                  <button
                    onClick={() => handleCompanyClick(lead.companyName)}
                    className="font-medium text-primary hover:underline"
                  >
                    {lead.companyName}
                  </button>
                </TableCell>
                <TableCell>{lead.contactPerson}</TableCell>
                <TableCell className="text-muted-foreground">{lead.contactEmail}</TableCell>
                <TableCell>{lead.role}</TableCell>
                <TableCell>
                  <TierBadge tier={lead.tier} />
                </TableCell>
                <TableCell>
                  <Select
                    value={lead.status}
                    onValueChange={(value) => onStatusChange(lead.id, value as LeadStatus)}
                  >
                    <SelectTrigger className="w-[160px]">
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
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {lead.comments.length} {lead.comments.length === 1 ? "comment" : "comments"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEmailDialog(lead)}
                      title="Send Email"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCommentingLead(commentingLead === lead.id ? null : lead.id)}
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
                  <TableCell colSpan={8} className="bg-muted/50">
                    <div className="space-y-3 py-2">
                      {lead.comments.length > 0 && (
                        <div className="space-y-2">
                          {lead.comments.map((comment) => (
                            <div key={comment.id} className="rounded-lg bg-card p-3 border">
                              <p className="text-sm">{comment.text}</p>
                              <p className="text-xs text-muted-foreground mt-1">
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
                          className="min-h-[80px]"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddComment(lead.id)}
                          disabled={!commentText.trim()}
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
