import type { ListingSyncStatus } from "@/types/marketplace";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

export const LISTING_SYNC_STATUS_CONFIG: Record<ListingSyncStatus, { label: string; variant: BadgeVariant }> = {
  not_listed: { label: "Not Listed", variant: "muted" },
  pending: { label: "Pending", variant: "warn" },
  synced: { label: "Live", variant: "ok" },
  out_of_stock: { label: "Out of Stock", variant: "warn" },
  price_locked: { label: "Price Locked (On Sale)", variant: "warn" },
  error: { label: "Error", variant: "danger" },
};
