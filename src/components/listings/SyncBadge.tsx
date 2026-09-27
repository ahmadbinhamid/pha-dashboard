import { Badge } from "@/components/ui/Badge";
import type { ListingSyncStatus } from "@/types/marketplace";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";

interface SyncBadgeProps {
  status: ListingSyncStatus;
  // Optional platform name prefix (e.g. "eBay: Live") — used by the grouped Listings view so each per-channel badge says which channel it's for.
  label?: string;
}

export function SyncBadge({ status, label }: SyncBadgeProps) {
  const cfg = LISTING_SYNC_STATUS_CONFIG[status];
  const text = cfg?.label ?? status;
  return <Badge variant={cfg?.variant ?? "muted"}>{label ? `${label}: ${text}` : text}</Badge>;
}
