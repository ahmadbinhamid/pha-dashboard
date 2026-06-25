import { Badge } from "@/components/ui/badge";
import type { ListingSyncStatus } from "@/types/marketplace";

const STATUS_LABEL: Record<ListingSyncStatus, string> = {
  not_listed: "Not listed",
  pending: "Pending",
  synced: "Live",
  out_of_stock: "Out of stock",
  error: "Error",
};

const STATUS_VARIANT: Record<ListingSyncStatus, "muted" | "warn" | "ok" | "danger"> = {
  not_listed: "muted",
  pending: "warn",
  synced: "ok",
  out_of_stock: "warn",
  error: "danger",
};

interface SyncBadgeProps {
  status: ListingSyncStatus;
}

export function SyncBadge({ status }: SyncBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "muted"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
