import { Badge } from "@/components/ui/badge";

interface TierBadgeProps {
  tier: number;
}

const tierConfig: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  1: { label: "Tier 1", variant: "default", className: "bg-green-500 hover:bg-green-600 text-white" },
  2: { label: "Tier 2", variant: "default", className: "bg-blue-500 hover:bg-blue-600 text-white" },
  3: { label: "Tier 3", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  4: { label: "Tier 4", variant: "default", className: "bg-orange-500 hover:bg-orange-600 text-white" },
};

export function TierBadge({ tier }: TierBadgeProps) {
  const config = tierConfig[tier] || tierConfig[4];
  
  return (
    <Badge variant={config.variant} className={`font-medium ${config.className || ""}`}>
      {config.label}
    </Badge>
  );
}

