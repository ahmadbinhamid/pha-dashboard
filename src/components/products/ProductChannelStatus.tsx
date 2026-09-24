import { cn } from "@/utils/cn";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { ViewOnChannelLink } from "@/components/channels/ViewOnChannelLink";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";
import type { ChannelSummary } from "@/types/channel";
import type { AnyMarketplaceListing, GroupedListingSummary } from "@/types/marketplace";

// NOTE: channels come from GET /channels; a dot's colour is only ever status.

type ListingLike = Pick<AnyMarketplaceListing | GroupedListingSummary, "platform" | "sync_status" | "synced_at" | "external_url">;

const DOT_COLOR: Record<string, string> = {
  synced: "bg-ok",
  pending: "bg-warn",
  out_of_stock: "bg-warn",
  price_locked: "bg-warn",
  error: "bg-danger",
  not_listed: "bg-fg/20",
};

// Plain text colour, no pill, so a status doesn't outweigh "Not listed" rows.
const STATUS_TEXT_COLOR: Record<string, string> = {
  synced: "text-ok",
  pending: "text-warn",
  out_of_stock: "text-warn",
  price_locked: "text-warn",
  error: "text-danger",
};

// Collapsed "Channels" cell: a status dot per channel plus "2/6 live".
export function ProductChannelDots({
  channels,
  listings,
}: {
  channels: ChannelSummary[];
  listings: ListingLike[];
}) {
  // Keyed by string: channel keys come from the server registry.
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

// Expanded panel: per-channel status, a live link, and one Open/List action.
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
  // Keyed by string: channel keys come from the server registry.
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
            {/* Icon only: the brand mark already names the channel. */}
            <span className="flex w-10 shrink-0 items-center" title={channel.name}>
              <ChannelAvatar name={channel.name} index={index} channelKey={channel.key} size="md" />
            </span>
            {/* Same status dot as the collapsed row. */}
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
            <ViewOnChannelLink url={listing?.external_url} channelName={channel.name} compact />
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
