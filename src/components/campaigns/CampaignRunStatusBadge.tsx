import { Badge } from "@/components/ui/Badge";
import { RUN_STATUS_BADGE } from "@/config/campaigns";
import type { RunStatus } from "@/types/campaign";

export function CampaignRunStatusBadge({ status }: { status: RunStatus }) {
  const { label, variant } = RUN_STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
