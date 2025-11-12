import { LeadStatus } from "@/types/lead";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: LeadStatus;
}

const statusConfig: Record<LeadStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  not_contacted: { label: "Not Contacted", variant: "secondary" },
  contacted: { label: "Contacted", variant: "outline" },
  qualified: { label: "Qualified", variant: "default" },
  in_progress: { label: "In Progress", variant: "default" },
  closed_won: { label: "Closed Won", variant: "default" },
  closed_lost: { label: "Closed Lost", variant: "destructive" },
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
