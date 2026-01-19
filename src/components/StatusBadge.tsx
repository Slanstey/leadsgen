import { LeadStatus } from "@/types/lead";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: LeadStatus;
}

const statusConfig: Record<LeadStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  not_contacted: { label: "Not Contacted", variant: "secondary" },
  contacted: { label: "Contacted", variant: "outline" },
  discussing_scope: { label: "Discussing Scope", variant: "default" },
  proposal_delivered: { label: "Proposal Delivered", variant: "default" },
  ignored: { label: "Ignored", variant: "secondary" }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  // Fallback for unknown statuses
  if (!config) {
    return (
      <Badge variant="secondary" className="font-medium">
        {status}
      </Badge>
    );
  }
  
  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  );
}
