import { Badge } from "@/components/ui/Badge";
import type { EbayListing } from "@/types/marketplace";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";

interface Props {
  listing?: EbayListing | null;
}

export function EbaySyncStatusSection({ listing }: Props) {
  const statusCfg = LISTING_SYNC_STATUS_CONFIG[listing?.sync_status ?? "not_listed"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-fg/60">Listing Status</p>
          <Badge variant={statusCfg.variant} className="mt-1">
            {statusCfg.label}
          </Badge>
        </div>

        <div>
          <p className="text-xs text-fg/60">Last Synced</p>
          <p className="mt-1 text-sm font-medium text-fg">
            {listing?.synced_at
              ? new Date(listing.synced_at).toLocaleString("en-AU")
              : "N/A"}
          </p>
        </div>

        {listing?.external_listing_id && (
          <div>
            <p className="text-xs text-fg/60">eBay Item ID</p>
            <p className="mt-1 text-sm font-medium text-fg">
              {listing.external_listing_id}
            </p>
          </div>
        )}

        {listing?.ebay_item_url && (
          <a
            href={listing.ebay_item_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            View on eBay
          </a>
        )}
      </div>

      {listing?.sync_status === "price_locked" && (
        <div className="rounded-md bg-warn/10 px-3 py-2 text-sm text-warn">
          <span className="font-medium">Price not updated: </span>
          This offer is part of an active eBay sale, so eBay rejected the price change. Remove it from the sale (or
          change the sale's price-update setting) on eBay, then sync again.
        </div>
      )}

      {listing?.sync_error && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <span className="font-medium">Sync error: </span>{listing.sync_error}
        </div>
      )}

      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-fg/70">
        Saving will store to local inventory. Use{" "}
        <strong>Save &amp; Push to eBay</strong> to create or update the live
        eBay listing.
      </div>
    </div>
  );
}
