import { Badge } from "@/components/ui/badge";
import { LeadTier } from "@/types/lead";

interface TierBadgeProps {
  tier: LeadTier;
}

const tierConfig: Record<LeadTier, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  "1st": { label: "1st Degree", variant: "default", className: "bg-green-500 hover:bg-green-600 text-white" },
  "2nd": { label: "2nd Degree", variant: "default", className: "bg-blue-500 hover:bg-blue-600 text-white" },
  "3rd": { label: "3rd Degree", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
};

export function TierBadge({ tier }: TierBadgeProps) {
  const config = tierConfig[tier] || tierConfig["2nd"];
  
  return (
    <Badge variant={config.variant} className={`font-medium ${config.className || ""}`}>
      {config.label}
    </Badge>
  );
}

