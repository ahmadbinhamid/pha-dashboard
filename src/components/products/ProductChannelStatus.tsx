import { cn } from "@/utils/cn";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";
import type { ChannelSummary } from "@/types/channel";
import type { AnyMarketplaceListing, GroupedListingSummary } from "@/types/marketplace";

// Extracted from ListingsPage.tsx's per-product expand pattern so the Products page and the Listings page's grouped fallback don't reimplement it. `channels` from GET /channels, never hardcoded, so new adapters show up automatically.
//
// A colored dot means one thing everywhere: sync status/health — the same mapping used by the collapsed row, expanded panel, and top channel-summary cards. Channel identity is its own separate element (ChannelAvatar) with no status color, so "which channel" and "is it OK" never compete for the same pixel.

type ListingLike = Pick<AnyMarketplaceListing | GroupedListingSummary, "platform" | "sync_status" | "synced_at">;

const DOT_COLOR: Record<string, string> = {
  synced: "bg-ok",
  pending: "bg-warn",
  out_of_stock: "bg-warn",
  price_locked: "bg-warn",
  error: "bg-danger",
  not_listed: "bg-fg/20",
};

// Status → plain text color, no pill background, so a real listing's status doesn't visually outweigh its bare-text "Not listed" neighbors.
const STATUS_TEXT_COLOR: Record<string, string> = {
  synced: "text-ok",
  pending: "text-warn",
  out_of_stock: "text-warn",
  price_locked: "text-warn",
  error: "text-danger",
};

// Collapsed row's "Channels" cell — a dot per registered channel (colored by
// that channel's listing status, dim if not listed) plus a short summary
// string, e.g. "2/6 live · 1 syncing".
export function ProductChannelDots({
  channels,
  listings,
}: {
  channels: ChannelSummary[];
  listings: ListingLike[];
}) {
  // Keyed by plain string, not MarketplacePlatform, since channel.key comes from the backend's dynamic adapter registry — a wider set than the frontend's closed union.
  const byPlatform = new Map<string, ListingLike>(listings.map((l) => [l.platform, l]));
  const liveCount = channels.filter((c) => byPlatform.get(c.key)?.sync_status === "synced").length;
  const pendingCount = channels.filter((c) => byPlatform.get(c.key)?.sync_status === "pending").length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {channels.map((channel) => {
          const listing = byPlatform.get(channel.key);
          const status = listing?.sync_status ?? "not_listed";
          return (
            <span
              key={channel.key}
              title={`${channel.name}: ${LISTING_SYNC_STATUS_CONFIG[status]?.label ?? status}`}
              className={cn("h-2 w-2 shrink-0 rounded-full", DOT_COLOR[status] ?? "bg-fg/20")}
            />
          );
        })}
      </div>
      <span className="whitespace-nowrap text-xs text-fg/50">
        {liveCount}/{channels.length} live{pendingCount > 0 ? ` · ${pendingCount} syncing` : ""}
      </span>
    </div>
  );
}

// Expanded detail panel: one row per channel with this product's real status (or "Ready to publish"), and a single "Open"/"List" action. Push/retry/delete stay Listings-tab-only — this view is for browsing, not day-to-day operations.
export function ProductChannelDetail({
  channels,
  listings,
  onOpen,
  onList,
}: {
  channels: ChannelSummary[];
  listings: ListingLike[];
  onOpen: (platform: string) => void;
  onList: (platform: string) => void;
}) {
  // Keyed by plain string, not MarketplacePlatform, since channel.key comes from the backend's dynamic adapter registry — a wider set than the frontend's closed union.
  const byPlatform = new Map<string, ListingLike>(listings.map((l) => [l.platform, l]));

  return (
    <div className="divide-y divide-border/60">
      {channels.map((channel, index) => {
        const listing = byPlatform.get(channel.key);
        const isListed = !!listing;
        const status = listing?.sync_status;
        const statusLabel = listing ? (LISTING_SYNC_STATUS_CONFIG[listing.sync_status]?.label ?? listing.sync_status) : "Not listed";
        const statusColor = listing ? (STATUS_TEXT_COLOR[listing.sync_status] ?? "text-fg/70") : "text-fg/40";

        return (
          <div key={channel.key} className="flex items-center gap-3 py-2.5">
            {/* Icon only — the brand mark already identifies the channel, so a text label was redundant; sized up to "md" since it doesn't share the row with text. */}
            <span className="flex w-10 shrink-0 items-center" title={channel.name}>
              <ChannelAvatar name={channel.name} index={index} channelKey={channel.key} size="md" />
            </span>
            {/* Same dot/color the collapsed row uses for this status — see this file's header comment. */}
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[status ?? "not_listed"])}
              aria-hidden="true"
            />
            <span className={cn("w-20 shrink-0 text-xs font-medium", statusColor)}>{statusLabel}</span>
            <span className="flex-1 truncate text-xs text-fg/45">
              {listing?.synced_at
                ? `Synced ${new Date(listing.synced_at).toLocaleDateString("en-AU")}`
                : isListed
                  ? "Queued for next sync"
                  : "Ready to publish"}
            </span>
            <button
              type="button"
              onClick={() => (isListed ? onOpen(channel.key) : onList(channel.key))}
              className={cn(
                "shrink-0 text-xs font-medium transition-colors",
                isListed ? "text-fg/60 hover:text-fg" : "text-accent hover:text-accent/80",
              )}
            >
              {isListed ? "Open →" : "List →"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
