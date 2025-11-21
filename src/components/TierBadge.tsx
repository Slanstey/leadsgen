import { Badge } from "@/components/ui/badge";
import { LeadTier } from "@/types/lead";

interface TierBadgeProps {
  tier: LeadTier;
}

const tierConfig: Record<LeadTier, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  good: { label: "Good", variant: "default", className: "bg-green-500 hover:bg-green-600 text-white" },
  medium: { label: "Medium", variant: "default", className: "bg-blue-500 hover:bg-blue-600 text-white" },
  bad: { label: "Bad", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
};

export function TierBadge({ tier }: TierBadgeProps) {
  const config = tierConfig[tier] || tierConfig.medium;
  
  return (
    <Badge variant={config.variant} className={`font-medium ${config.className || ""}`}>
      {config.label}
    </Badge>
  );
}

