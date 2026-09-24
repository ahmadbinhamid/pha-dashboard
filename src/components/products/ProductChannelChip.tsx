import { LISTING_SYNC_STATUS_CONFIG, LISTING_SYNC_STATUS_SEVERITY } from "@/config/listingStatus";
import { isAwaitingSync } from "@/hooks/useProductChannelListings";
import { cn } from "@/utils/cn";
import type { ChannelSummary } from "@/types/channel";
import type { AnyMarketplaceListing, ListingSyncStatus } from "@/types/marketplace";

const DOT: Record<string, string> = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" };

interface ProductChannelChipProps {
  channels: ChannelSummary[];
  listings: AnyMarketplaceListing[];
  syncingSince: number | null;
  onClick: () => void;
}

// Header chip: worst sync status across channels; opens the channels tab.
export function ProductChannelChip({ channels, listings, syncingSince, onClick }: ProductChannelChipProps) {
  const statuses = listings.map((l): ListingSyncStatus => (isAwaitingSync(l, syncingSince) ? "pending" : l.sync_status));
  const worst = LISTING_SYNC_STATUS_SEVERITY.find((s) => statuses.includes(s));
  const name = listings.length === 1 ? (channels.find((c) => c.key === listings[0].platform)?.name ?? listings[0].platform) : `${listings.length} channels`;
  const cfg = worst ? LISTING_SYNC_STATUS_CONFIG[worst] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Open sales channels"
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-fg/65 transition-colors hover:border-fg/30 hover:text-fg outline-none! focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg ? (DOT[cfg.variant] ?? "bg-fg/30") : "bg-fg/30")} />
      {listings.length ? `${name} · ${worst === "pending" ? "Syncing" : cfg?.label}` : "Not listed"}
    </button>
  );
}
