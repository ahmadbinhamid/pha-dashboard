import { Badge } from "@/components/ui/badge";
import type { ListingSyncStatus } from "@/types/marketplace";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listing-status";

interface SyncBadgeProps {
  status: ListingSyncStatus;
}

export function SyncBadge({ status }: SyncBadgeProps) {
  const cfg = LISTING_SYNC_STATUS_CONFIG[status];
  return <Badge variant={cfg?.variant ?? "muted"}>{cfg?.label ?? status}</Badge>;
}
