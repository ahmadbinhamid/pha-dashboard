import { Badge } from "@/components/ui/Badge";
import { CAMPAIGN_STATUS_BADGE } from "@/config/campaigns";
import type { CampaignStatus } from "@/types/campaign";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { label, variant } = CAMPAIGN_STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
