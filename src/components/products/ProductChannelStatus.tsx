import { cn } from "@/utils/cn";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";
import type { ChannelSummary } from "@/types/channel";
import type { AnyMarketplaceListing, GroupedListingSummary } from "@/types/marketplace";

// Extracted from ListingsPage.tsx's own per-product expand pattern so the
// Products page (channel status per product, collapsed dot row + expandable
// detail) and the Listings page's grouped fallback don't each reimplement
// it. Takes `channels` from GET /channels (never a
// hardcoded platform list) so a newly-registered adapter shows up here
// automatically, with no changes to this component.
//
// A colored dot means ONE thing everywhere on this page: sync status/health
// (ok=live, warn=needs a push, danger=error, dim=not listed) — the same
// mapping the collapsed row and the expanded panel both use below, and the
// same one the page's top channel-summary cards use. Earlier, the expanded
// panel colored its dot by CHANNEL IDENTITY instead (a categorical palette,
// unrelated to status), so the same visual read as "health" one line and
// "which channel" the next — that's what made this confusing. Identity is
// now its own separate element (ChannelAvatar), which never carries a
// status color, so the two questions ("which channel" / "is it OK") never
// compete for the same pixel.

type ListingLike = Pick<AnyMarketplaceListing | GroupedListingSummary, "platform" | "sync_status" | "synced_at">;

const DOT_COLOR: Record<string, string> = {
  synced: "bg-ok",
  pending: "bg-warn",
  out_of_stock: "bg-warn",
  price_locked: "bg-warn",
  error: "bg-danger",
  not_listed: "bg-fg/20",
};

// Status → plain text color (no pill/badge background) — the expanded
// detail panel shows status as bare colored text right next to "Not
// listed" (also bare text), so a real listing's status doesn't visually
// jump out with a pill background its unlisted neighbors don't have.
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
  // Keyed by plain string, not MarketplacePlatform — channel.key comes from
  // the backend's dynamic adapter registry (any future platform), a wider
  // set than the frontend's closed MarketplacePlatform union.
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

// Expanded detail panel — one row per registered channel, showing this
// product's real status on it (or "Ready to publish" if not listed yet),
// with a single primary action: "Open" (edit) for a listed channel, "List"
// (create) for one it isn't on yet. Push/retry/delete stay Listings-tab-only
// — this view is for browsing "is this product live where it should be",
// not day-to-day per-listing operations.
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
  // Keyed by plain string, not MarketplacePlatform — channel.key comes from
  // the backend's dynamic adapter registry (any future platform), a wider
  // set than the frontend's closed MarketplacePlatform union.
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
            {/* Icon only, no name label — the brand mark itself (eBay's
                wordmark, Google Merchant Center's icon) already identifies
                the channel at a glance, so repeating it as text next to an
                icon built to say the same thing was redundant. Sized up to
                "md" now that it doesn't have to share the row with text. */}
            <span className="flex w-10 shrink-0 items-center" title={channel.name}>
              <ChannelAvatar name={channel.name} index={index} channelKey={channel.key} size="md" />
            </span>
            {/* Same dot/color the collapsed row uses for this exact status —
                see this file's header comment for why that consistency is
                the point. */}
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
